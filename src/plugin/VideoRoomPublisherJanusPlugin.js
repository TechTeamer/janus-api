const JanusPlugin = require('../JanusPlugin')
const VideoRoomListenerJanusPlugin = require('./VideoRoomListenerJanusPlugin')
const SdpHelper = require('../SdpHelper')

class VideoRoomPublisherJanusPlugin extends JanusPlugin {
  constructor (roomId, roomCodec, isMobile, clientTypes, clientType, config, logger, filterDirectCandidates = false) {
    if (!clientTypes.includes(clientType)) {
      throw new Error('unknown clientType', clientType)
    }
    if (!roomId) {
      throw new Error('unknown roomId')
    }

    super(logger)
    this.roomId = roomId
    this.roomCodec = roomCodec
    this.isMobile = isMobile
    this.clientType = clientType
    this.pluginName = 'janus.plugin.videoroom'

    this.janusRoomId = undefined
    this.janusRoomMemberId = undefined
    this.janusRoomPrivateMemberId = undefined
    this.janusRemoteRoomMemberId = undefined

    this.janusListenerPlugin = undefined

    this.filterDirectCandidates = !!filterDirectCandidates

    this.config = config
    this.clientTypes = clientTypes
    this.sdpHelper = new SdpHelper(this.logger)
  }

  connect () {
    return this.transaction('message', { body: { request: 'list' } }, 'success').then((param) => {
      let {data} = param || {}
      if (!data || !Array.isArray(data.list)) {
        this.logger.error('VideoRoomPublisherJanusPlugin, could not find roomList', data)
        throw new Error('VideoRoomPublisherJanusPlugin, could not find roomList')
      }

      let foundRoom = data.list.find((room) => room.description === '' + this.roomId)
      if (foundRoom) {
        this.janusRoomId = foundRoom.room
        return this.join()
      } else {
        return this.createRoom()
      }
    }).catch((err) => {
      this.logger.error('VideoRoomPublisherJanusPlugin, cannot list rooms', err)
      throw err
    })
  }

  join () {
    let join = { request: 'join', room: this.janusRoomId, ptype: 'publisher', display: this.clientType }

    return new Promise((resolve, reject) => {
      this.transaction('message', {body: join}, 'event').then((param) => {
        let {data} = param || {}
        if (!data || !data.id || !data.private_id || !data.publishers) {
          this.logger.error('VideoRoomPublisherJanusPlugin, could not join room', data)
          throw new Error('VideoRoomPublisherJanusPlugin, could not join room')
        }
        this.janusRoomMemberId = data.id
        this.janusRoomPrivateMemberId = data.private_id

        resolve(data.publishers)

        if (Array.isArray(data.publishers) && data.publishers.length) {
          this.connectRemoteMember(data.publishers)
        }
      }).catch((err) => {
        if (err && err['error_code'] === 426) { // JANUS_VIDEOROOM_ERROR_NO_SUCH_ROOM = 426
          this.createRoom().then(resolve).catch(reject)
        } else {
          this.logger.error('VideoRoomPublisherJanusPlugin, unknown error connecting to room', err)
          reject(err)
        }
      })
    })
  }

  createRoom () {
    let videoorientExt
    if (this.roomCodec === 'h264' || this.isMobile) {
      videoorientExt = false
    }

    let createRoom = {
      request: 'create',
      description: '' + this.roomId,
      record: true,
      videocodec: this.roomCodec,
      rec_dir: this.config.webrtc.server.recordDirectory + this.roomId + '/',
      publishers: 20, // a high number to surely avoid race conditions
      videoorient_ext: videoorientExt
    }

    if (this.config.webrtc.performance) {
      if (this.config.webrtc.performance.bitrate) {
        createRoom.bitrate = this.config.webrtc.performance.bitrate
      }
      if (this.config.webrtc.performance.firSeconds) {
        createRoom.fir_freq = this.config.webrtc.performance.firSeconds
      }
    }

    return this.transaction('message', { body: createRoom }, 'success').then((param) => {
      let {data} = param || {}
      if (!data || !data.room) {
        this.logger.error('VideoRoomPublisherJanusPlugin, could not create room', data)
        throw new Error('VideoRoomPublisherJanusPlugin, could not create room')
      }

      this.janusRoomId = data.room

      return this.join()
    }).catch((err) => {
      this.logger.logger('VideoRoomPublisherJanusPlugin, cannot create room', err)
      throw err
    })
  }

  configure (offer) {
    if (!this.janusRoomMemberId) {
      this.logger('VideoRoomPublisherJanusPlugin, cannot configure without janusRoomMemberId')
      return
    }

    let configure = { request: 'configure', audio: true, video: true }

    let jsep = offer
    if (this.filterDirectCandidates && jsep.sdp) {
      jsep.sdp = this.sdpHelper.filterDirectCandidates(jsep.sdp)
    }

    return this.transaction('message', { body: configure, jsep }, 'event').then((param) => {
      let {json} = param || {}
      if (!json.jsep) {
        throw new Error('cannot configure')
      }

      let jsep = json.jsep
      if (this.filterDirectCandidates && jsep.sdp) {
        jsep.sdp = this.sdpHelper.filterDirectCandidates(jsep.sdp)
      }

      return jsep
    })
  }

  candidate (candidate) {
    if (this.filterDirectCandidates && candidate.candidate && this.sdpHelper.isDirectCandidate(candidate.candidate)) {
      return
    }

    return this.transaction('trickle', { candidate })
  }

  onmessage (data, json) {
    // TODO data.videoroom === 'destroyed' handling

    // TOOD unbublished === 'ok' handling : we are unpublished

    if (!data || !data.videoroom || !data.videoroom === 'event') {
      this.logger.error('VideoRoomPublisherJanusPlugin got unknown message', json)
      return
    }
    if (data.room !== this.janusRoomId) {
      this.logger.error('VideoRoomPublisherJanusPlugin got unknown roomId', this.janusRoomId, json)
      return
    }

    if (data.unpublished || data.leaving) {
      let leavingId = data.unpublished || data.leaving
      if (this.janusRemoteRoomMemberId && this.janusRemoteRoomMemberId === leavingId) {
        this.disconnectRemoteMember()
      }
    } else if (Array.isArray(data.publishers)) {
      this.connectRemoteMember(data.publishers)
    } else {
      this.logger.error('VideoRoomPublisherJanusPlugin got unknown event', json)
    }
  }

  disconnectRemoteMember () {
    this.janusRemoteRoomMemberId = undefined

    if (!this.janusListenerPlugin) {
      return Promise.resolve()
    }

    return this.janus.destroyPlugin(this.janusListenerPlugin).then(() => {
      this.janusListenerPlugin = undefined
      this.emit('videochat:receivingPeer:stop')
    })
  }

  connectRemoteMember (publishers) {
    let remoteMember = publishers.find((publisher) => {
      if (!publisher || !publisher.id || !publisher.display) {
        // this.logger.error('VideoRoomPublisherJanusPlugin got unknown publishers', this.janusRoomId, publishers)
        return false
      }
      if (!this.clientTypes.includes(publisher.display)) {
        // this.logger.error('VideoRoomPublisherJanusPlugin got unknown publisher display name', publishers)
        return false
      }
      if (publisher.display === this.clientType) {
        // this.logger.error('VideoRoomPublisherJanusPlugin remoteMember display name is the same', publishers)
        return false
      }
      return true
    })

    if (!remoteMember) {
      this.logger.error('VideoRoomPublisherJanusPlugin no remoteMember to connect', publishers)
      return Promise.reject(new Error('VideoRoomPublisherJanusPlugin no remoteMember to connect'))
    }

    if (this.janusRoomMemberId && this.janusRoomMemberId === remoteMember.id) { // reconnect
      return
    }

    let promise = Promise.resolve()
    if (this.janusRemoteRoomMemberId) {
      promise = this.disconnectRemoteMember()
    }

    return promise.then(() => {
      this.janusRemoteRoomMemberId = remoteMember.id
      this.janusListenerPlugin = new VideoRoomListenerJanusPlugin(this.roomId, this.janusRoomId, this.janusRoomPrivateMemberId, remoteMember.id, this.logger, this.filterDirectCandidates)

      return this.janus.addPlugin(this.janusListenerPlugin).then(() => {
        this.janusListenerPlugin.on('jsep', (jsep) => {
          if (this.filterDirectCandidates && jsep.sdp) {
            jsep.sdp = this.sdpHelper.filterDirectCandidates(jsep.sdp)
          }

          this.emit('videochat:receivingPeer:start', jsep)
        })

        return this.janusListenerPlugin.join()
      })
    })
  }

  setListenerAnswer (answer) {
    if (!this.janusListenerPlugin) {
      this.logger.error('VideoRoomPublisherJanusPlugin got listener answer without listener', answer)
      return Promise.reject(new Error('VideoRoomPublisherJanusPlugin got listener answer without listener'))
    }

    return this.janusListenerPlugin.setAnswer(answer)
  }

  listenerCandidate (candidate) {
    if (!this.janusListenerPlugin) {
      this.logger.error('VideoRoomPublisherJanusPlugin got candidate answer without listener', candidate)
      return // Promise.reject(new Error('VideoRoomPublisherJanusPlugin got listener answer without listener'))
    }

    return this.janusListenerPlugin.candidate(candidate)
  }

  mediaState (medium, on) {
    this.logger.debug('JANUS mediaState', this.roomId, this.clientType, medium, on)
  }

  webrtcState (isReady, cause) {
    if (isReady) {
      this.emit('videochat:webrtcStream', {
        roomId: this.roomId,
        clientType: this.clientType,
        janusRoomId: this.janusRoomId,
        janusRoomMemberId: this.janusRoomMemberId,
        janusRoomPrivateMemberId: this.janusRoomPrivateMemberId,
        janusSessionId: this.janus.sessionId,
        janusHandleId: this.janusHandleId
      })
    }
  }

  detach () {
    return this.disconnectRemoteMember().then(() => {
      super.detach()
    })
  }
}

module.exports = VideoRoomPublisherJanusPlugin
