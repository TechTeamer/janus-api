import JanusPlugin from '../JanusPlugin.js'
import SdpHelper from '../SdpHelper.js'
import SdpUtils from 'sdp'

class VideoRoomPublisherJanusPlugin extends JanusPlugin {
  constructor (config, display, logger, filterDirectCandidates = false) {
    if (!config) {
      throw new Error('unknown config')
    }

    super(logger)
    this.display = display
    this.pluginName = 'janus.plugin.videoroom'

    this.janusRoomId = undefined
    this.janusRoomMemberId = undefined
    this.janusRoomPrivateMemberId = undefined

    this.filterDirectCandidates = !!filterDirectCandidates

    this.config = config
    this.sdpHelper = new SdpHelper(this.logger)

    this.offerSdp = undefined
    this.answerSdp = undefined

    this.rtpForwardVideoStreamId = undefined
    this.rtpForwardAudioStreamId = undefined
    this.rtpForwardDataStreamId = undefined
  }

  /**
   * Usage: ffmpeg -analyzeduration 300M -probesize 300M -protocol_whitelist file,udp,rtp -i sdp.file  -c:v h264 -c:a aac -ar 16k -ac 1 -g 50 -max_muxing_queue_size 9999 -preset ultrafast -tune zerolatency  -f flv rtmp://127.0.0.1:1935/mytv/stream
   */
  startRTPForward (host, videoPortNumber, audioPortNumber) {
    const body = {
      request: 'rtp_forward',
      room: this.janusRoomId,
      publisher_id: this.janusRoomMemberId,
      host
    }

    if (videoPortNumber) {
      body.video_port = videoPortNumber
    }
    if (audioPortNumber) {
      body.audio_port = audioPortNumber
    }

    return this.transaction('message', { body }, 'success').then(({ data, json }) => {
      if (data && data.rtp_stream && data.rtp_stream.video_stream_id) {
        this.rtpForwardVideoStreamId = data.rtp_stream.video_stream_id
      }
      if (data && data.rtp_stream && data.rtp_stream.audio_stream_id) {
        this.rtpForwardAudioStreamId = data.rtp_stream.audio_stream_id
      }
      if (data && data.rtp_stream && data.rtp_stream.data_stream_id) {
        this.rtpForwardDataStreamId = data.rtp_stream.data_stream_id
      }

      let rtpSdp = 'v=0\n' +
        `o=- 0 0 IN IP4 ${host}\n` +
        `s=janus-api:${this.janusRoomId}.${this.janusRoomMemberId}\n` +
        `c=IN IP4 ${host}\n` +
        't=0 0\n' +
        'a=tool:janus-api\n'

      SdpUtils.splitSections(this.answerSdp).forEach((section, index) => {
        if (index === 0) {
          return // session part
        }

        const mid = SdpUtils.getMid(section)
        const rtp = SdpUtils.parseRtpParameters(section)

        const codec = rtp.codecs[0]
        if (!codec) {
          return
        }

        if (mid === 'video' && videoPortNumber) {
          rtpSdp +=
            `m=video ${videoPortNumber} RTP/AVP ${codec.payloadType}\n` +
            `a=rtpmap:${codec.payloadType} ${codec.name}/${codec.clockRate}\n` +
            'a=fmtp:11 packetization-mode=1\n' +
            'a=rtcp-mux\n'
        }
        if (mid === 'audio' && audioPortNumber) {
          rtpSdp +=
            `m=audio ${audioPortNumber} RTP/AVP ${codec.payloadType}\n` +
            `a=rtpmap:${codec.payloadType} ${codec.name}/${codec.clockRate}\n` +
            'a=fmtp:11 packetization-mode=1\n' +
            'a=rtcp-mux\n'
        }
      })

      return rtpSdp
    }).catch((err) => {
      this.logger.error('VideoRoomPublisherJanusPlugin, cannot RTP forward', err)
      throw err
    })
  }

  stopRTPForward () {
    const ret = []
    if (this.rtpForwardVideoStreamId) {
      ret.push(this.stopRTPForwardStream(this.rtpForwardVideoStreamId))
    }
    if (this.rtpForwardAudioStreamId) {
      ret.push(this.stopRTPForwardStream(this.rtpForwardAudioStreamId))
    }
    if (this.rtpForwardDataStreamId) {
      ret.push(this.stopRTPForwardStream(this.rtpForwardDataStreamId))
    }

    return Promise.all(ret)
  }

  stopRTPForwardStream (streamId) {
    const body = {
      request: 'stop_rtp_forward',
      room: this.janusRoomId,
      publisher_id: this.janusRoomMemberId,
      stream_id: streamId
    }

    return this.transaction('message', { body }, 'success').catch((err) => {
      this.logger.error('VideoRoomPublisherJanusPlugin, cannot stop RTP forward', err)
      throw err
    })
  }

  setRoomBitrate (bitrate) {
    const body = {
      request: 'edit',
      room: this.janusRoomId,
      new_bitrate: bitrate
    }

    return this.transaction('message', { body }, 'success').catch((err) => {
      this.logger.error('VideoRoomPublisherJanusPlugin, cannot set room bitrate', err)
      throw err
    })
  }

  connect () {
    return this.transaction('message', { body: { request: 'list' } }, 'success').then((param) => {
      const { data } = param || {}
      if (!data || !Array.isArray(data.list)) {
        this.logger.error('VideoRoomPublisherJanusPlugin, could not find roomList', data)
        throw new Error('VideoRoomPublisherJanusPlugin, could not find roomList')
      }

      const foundRoom = data.list.find((room) => room.description === '' + this.config.id)
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
    const body = { request: 'join', room: this.janusRoomId, ptype: 'publisher', display: this.display }

    return new Promise((resolve, reject) => {
      this.transaction('message', { body }, 'event').then((param) => {
        const { data } = param || {}
        if (!data || !data.id || !data.private_id || !data.publishers) {
          this.logger.error('VideoRoomPublisherJanusPlugin, could not join room', data)
          throw new Error('VideoRoomPublisherJanusPlugin, could not join room')
        }
        this.janusRoomMemberId = data.id
        this.janusRoomPrivateMemberId = data.private_id

        resolve(data.publishers)
      }).catch((err) => {
        if (err && err.error_code === 426) { // JANUS_VIDEOROOM_ERROR_NO_SUCH_ROOM = 426
          this.createRoom().then(resolve).catch(reject)
        } else {
          this.logger.error('VideoRoomPublisherJanusPlugin, unknown error connecting to room', err)
          reject(err)
        }
      })
    })
  }

  createRoom () {
    const body = Object.assign({ request: 'create' }, this.config.toJanusConfig())

    return this.transaction('message', { body }, 'success').then((param) => {
      const { data } = param || {}
      if (!data || !data.room) {
        this.logger.error('VideoRoomPublisherJanusPlugin, could not create room', data)
        throw new Error('VideoRoomPublisherJanusPlugin, could not create room')
      }

      this.janusRoomId = data.room

      return this.join()
    }).catch((err) => {
      this.logger.error('VideoRoomPublisherJanusPlugin, cannot create room', err)
      throw err
    })
  }

  configure (offer, relayAudio = true, relayVideo = true) {
    if (!this.janusRoomMemberId) {
      this.logger.error('VideoRoomPublisherJanusPlugin, cannot configure without janusRoomMemberId')
      return
    }

    const body = { request: 'configure', audio: relayAudio, video: relayVideo }

    const jsep = offer
    if (this.filterDirectCandidates && jsep.sdp) {
      jsep.sdp = this.sdpHelper.filterDirectCandidates(jsep.sdp)
    }

    this.offerSdp = jsep.sdp

    return this.transaction('message', { body, jsep }, 'event').then((param) => {
      const { json } = param || {}
      if (!json.jsep) {
        throw new Error('cannot configure')
      }

      const jsep = json.jsep
      if (this.filterDirectCandidates && jsep.sdp) {
        jsep.sdp = this.sdpHelper.filterDirectCandidates(jsep.sdp)
      }

      this.answerSdp = jsep.sdp

      return jsep
    })
  }

  candidate (candidate) {
    if (this.filterDirectCandidates && candidate && candidate.candidate && this.sdpHelper.isDirectCandidate(candidate.candidate)) {
      return
    }

    return this.transaction('trickle', { candidate })
  }

  onmessage (data, json) {
    // TODO data.videoroom === 'destroyed' handling
    // TODO unpublished === 'ok' handling : we are unpublished

    const { videoroom } = data || {}

    if (!data || !videoroom) {
      this.logger.error('VideoRoomPublisherJanusPlugin got unknown message', json)
      return
    }

    if (videoroom === 'slow_link') {
      this.logger.debug('VideoRoomPublisherJanusPlugin got slow_link', data)
      this.slowLink()
      return
    }

    if (videoroom === 'event') {
      const { room, unpublished, leaving, publishers } = data
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

      return
    }

    if (videoroom === 'keyframe') {
      this.emit('keyframe', data)
      return
    }

    if (videoroom === 'talking') {
      this.emit('talking')
      return
    }

    if (videoroom === 'stopped-talking') {
      this.emit('stoppedTalking')
      return
    }

    this.logger.error('VideoRoomPublisherJanusPlugin unhandled message:', videoroom, json)
  }

  listParticipants () {
    return this.transaction('message', { body: { request: 'listparticipants', room: this.janusRoomId } }, 'success').then((param) => {
      const { data } = param || {}
      if (!data || !Array.isArray(data.participants)) {
        this.logger.error('VideoRoomPublisherJanusPlugin, could not list participants', data)
        throw new Error('VideoRoomPublisherJanusPlugin, could not list participants')
      }
      return data.participants
    })
  }
}

export default VideoRoomPublisherJanusPlugin
