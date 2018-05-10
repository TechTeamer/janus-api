const JanusPlugin = require('../JanusPlugin')
const SdpHelper = require('../SdpHelper')
const SdpUtils = require('sdp')

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
    let body = {
      request: 'rtp_forward',
      room: this.janusRoomId,
      publisher_id: this.janusRoomMemberId,
      host: host
    }

    if (videoPortNumber) {
      body.video_port = videoPortNumber
    }
    if (audioPortNumber) {
      body.audio_port = audioPortNumber
    }

    return this.transaction('message', { body }, 'success').then(({data, json}) => {
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

        let mid = SdpUtils.getMid(section)
        let rtp = SdpUtils.parseRtpParameters(section)

        let codec = rtp.codecs[0]
        if (!codec) {
          return
        }

        if (mid === 'video' && videoPortNumber) {
          rtpSdp +=
            `m=video ${videoPortNumber} RTP/AVP ${codec.payloadType}\n` +
            `a=rtpmap:${codec.payloadType} ${codec.name}/${codec.clockRate}\n` +
            `a=fmtp:11 packetization-mode=1\n` +
            `a=rtcp-mux\n`
        }
        if (mid === 'audio' && audioPortNumber) {
          rtpSdp +=
            `m=audio ${audioPortNumber} RTP/AVP ${codec.payloadType}\n` +
            `a=rtpmap:${codec.payloadType} ${codec.name}/${codec.clockRate}\n` +
            `a=fmtp:11 packetization-mode=1\n` +
            `a=rtcp-mux\n`
        }
      })

      return rtpSdp
    }).catch((err) => {
      this.logger.error('VideoRoomPublisherJanusPlugin, cannot RTP forward', err)
      throw err
    })
  }

  stopRTPForward () {
    let ret = []
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
    let body = {
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
    let body = {
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
      let { data } = param || {}
      if (!data || !Array.isArray(data.list)) {
        this.logger.error('VideoRoomPublisherJanusPlugin, could not find roomList', data)
        throw new Error('VideoRoomPublisherJanusPlugin, could not find roomList')
      }

      let foundRoom = data.list.find((room) => room.description === '' + this.config.id)
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
    let body = { request: 'join', room: this.janusRoomId, ptype: 'publisher', display: this.display }

    return new Promise((resolve, reject) => {
      this.transaction('message', { body }, 'event').then((param) => {
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
    let body = {
      request: 'create',
      description: '' + this.config.id,
      record: this.config.record,
      videocodec: this.config.codec,
      rec_dir: this.config.recordDirectory,
      publishers: this.config.publishers,
      videoorient_ext: this.config.videoOrientExt
    }

    if (this.config.bitrate) {
      body.bitrate = this.config.bitrate
    }
    if (this.config.firSeconds) {
      body.fir_freq = this.config.firSeconds
    }

    return this.transaction('message', { body }, 'success').then((param) => {
      let { data } = param || {}
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

  configure (offer, offerAudio = true, offerVideo = true) {
    if (!this.janusRoomMemberId) {
      this.logger.error('VideoRoomPublisherJanusPlugin, cannot configure without janusRoomMemberId')
      return
    }

    let body = { request: 'configure', audio: offerAudio, video: offerVideo }

    let jsep = offer
    if (this.filterDirectCandidates && jsep.sdp) {
      jsep.sdp = this.sdpHelper.filterDirectCandidates(jsep.sdp)
    }

    this.offerSdp = jsep.sdp

    return this.transaction('message', { body, jsep }, 'event').then((param) => {
      let { json } = param || {}
      if (!json.jsep) {
        throw new Error('cannot configure')
      }

      let jsep = json.jsep
      if (this.filterDirectCandidates && jsep.sdp) {
        jsep.sdp = this.sdpHelper.filterDirectCandidates(jsep.sdp)
      }

      this.answerSdp = jsep.sdp

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
}

module.exports = VideoRoomPublisherJanusPlugin
