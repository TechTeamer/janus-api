const JanusPlugin = require('../JanusPlugin')
const SdpHelper = require('../SdpHelper')

class VideoRoomPublisherJanusPlugin extends JanusPlugin {
  constructor (roomConfig, display, janusConfig, logger, filterDirectCandidates = false) {
    if (!roomConfig) {
      throw new Error('unknown roomConfig')
    }

    super(logger)
    this.display = display
    this.pluginName = 'janus.plugin.videoroom'

    this.janusRoomId = undefined
    this.janusRoomMemberId = undefined
    this.janusRoomPrivateMemberId = undefined

    this.filterDirectCandidates = !!filterDirectCandidates

    this.roomConfig = roomConfig
    this.janusConfig = janusConfig
    this.sdpHelper = new SdpHelper(this.logger)
  }

  connect () {
    return this.transaction('message', { body: { request: 'list' } }, 'success').then((param) => {
      let { data } = param || {}
      if (!data || !Array.isArray(data.list)) {
        this.logger.error('VideoRoomPublisherJanusPlugin, could not find roomList', data)
        throw new Error('VideoRoomPublisherJanusPlugin, could not find roomList')
      }

      let foundRoom = data.list.find((room) => room.description === '' + this.roomConfig.id)
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
    let join = { request: 'join', room: this.janusRoomId, ptype: 'publisher', display: this.display }

    return new Promise((resolve, reject) => {
      this.transaction('message', { body: join }, 'event').then((param) => {
        let { data } = param || {}
        if (!data || !data.id || !data.private_id || !data.publishers) {
          this.logger.error('VideoRoomPublisherJanusPlugin, could not join room', data)
          throw new Error('VideoRoomPublisherJanusPlugin, could not join room')
        }
        this.janusRoomMemberId = data.id
        this.janusRoomPrivateMemberId = data.private_id

        resolve(data.publishers)
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
    let createRoom = {
      request: 'create',
      description: '' + this.room.id,
      record: this.janusConfig.record,
      videocodec: this.roomConfig.codec,
      rec_dir: this.janusConfig.recordDirectory + this.roomConfig.id + '/',
      publishers: this.roomConfig.publishers, // a high number to surely avoid race conditions
      videoorient_ext: this.roomConfig.videoOrientExt
    }

    if (this.roomConfig.bitrate) {
      createRoom.bitrate = this.roomConfig.bitrate
    }
    if (this.roomConfig.firSeconds) {
      createRoom.fir_freq = this.roomConfig.firSeconds
    }

    return this.transaction('message', { body: createRoom }, 'success').then((param) => {
      let { data } = param || {}
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
      let { json } = param || {}
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
    // TODO unpublished === 'ok' handling : we are unpublished

    let { videoroom, room, unpublished, leaving, publishers } = data

    if (!data || !videoroom || videoroom !== 'event') {
      this.logger.error('VideoRoomPublisherJanusPlugin got unknown message', json)
      return
    }
    if (room !== this.janusRoomId) {
      this.logger.error('VideoRoomPublisherJanusPlugin got unknown roomId', this.janusRoomId, json)
      return
    }

    if (unpublished) {
      this.emit('remoteMemberUnpublished', unpublished)
    } else if (leaving) {
      this.emit('remoteMemberLeaving', leaving)
    } else if (Array.isArray(publishers)) {
      this.emit('publishersUpdated', publishers)
    } else {
      this.logger.error('VideoRoomPublisherJanusPlugin got unknown event', json)
    }
  }

  mediaState (medium, on) {
    this.logger.debug('JANUS mediaState', this.roomConfig.id, this.display, medium, on)
  }

  webrtcState (isReady, cause) {
    if (isReady) {
      this.emit('videochat:webrtcStream', {
        roomId: this.roomConfig.id,
        display: this.display,
        janusRoomId: this.janusRoomId,
        janusRoomMemberId: this.janusRoomMemberId,
        janusRoomPrivateMemberId: this.janusRoomPrivateMemberId,
        janusSessionId: this.janus.sessionId,
        janusHandleId: this.janusHandleId
      })
    }
  }
}

module.exports = VideoRoomPublisherJanusPlugin
