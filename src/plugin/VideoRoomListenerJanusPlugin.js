const JanusPlugin = require('../JanusPlugin')
const SdpHelper = require('../SdpHelper')

class VideoRoomListenerJanusPlugin extends JanusPlugin {
  constructor (roomId, janusRoomId, roomMemberPrivateId, remoteFeedId, logger, filterDirectCandidates = false) {
    if (!roomId) {
      throw new Error('unknown roomId')
    }
    if (!roomMemberPrivateId) {
      throw new Error('unknown janusRoomPrivateMemberId')
    }

    super(logger)
    this.roomId = roomId
    this.janusRoomId = janusRoomId
    this.pluginName = 'janus.plugin.videoroom'
    this.janusRoomPrivateMemberId = roomMemberPrivateId
    this.janusRemoteFeedId = remoteFeedId
    this.filterDirectCandidates = !!filterDirectCandidates
    this.sdpHelper = new SdpHelper(this.logger)
  }

  join (offerAudio = true, offerVideo = true) {
    const join = {
      request: 'join',
      room: this.janusRoomId,
      ptype: 'subscriber',
      feed: this.janusRemoteFeedId,
      private_id: this.janusRoomPrivateMemberId,
      offer_video: offerVideo,
      offer_audio: offerAudio
    }

    return new Promise((resolve, reject) => {
      this.transaction('message', { body: join }, 'event').then((param) => {
        const { data, json } = param || {}
        if (!data || data.videoroom !== 'attached') {
          this.logger.error('VideoRoomListenerJanusPlugin join answer is not attached', data, json)
          throw new Error('VideoRoomListenerJanusPlugin join answer is not attached')
        }
        if (!json.jsep) {
          this.logger.error('VideoRoomListenerJanusPlugin join answer does not contains jsep', data, json)
          throw new Error('VideoRoomListenerJanusPlugin join answer does not contains jsep')
        }

        const jsep = json.jsep
        if (this.filterDirectCandidates && jsep.sdp) {
          jsep.sdp = this.sdpHelper.filterDirectCandidates(jsep.sdp)
        }

        this.emit('jsep', jsep)
        resolve(jsep)
      }).catch((err) => {
        this.logger.error('VideoRoomListenerJanusPlugin, unknown error connecting to room', err, join)
        reject(err)
      })
    })
  }

  setAnswer (answer) {
    const body = { request: 'start', room: this.janusRoomId }

    return new Promise((resolve, reject) => {
      const jsep = answer
      if (this.filterDirectCandidates && jsep && jsep.sdp) {
        jsep.sdp = this.sdpHelper.filterDirectCandidates(jsep.sdp)
      }

      this.transaction('message', { body, jsep }, 'event').then((param) => {
        const { data, json } = param || {}

        if (!data || data.started !== 'ok') {
          this.logger.error('VideoRoomListenerJanusPlugin set answer is not ok', data, json)
          throw new Error('VideoRoomListenerJanusPlugin set answer is not ok')
        }
        resolve()
      }).catch((err) => {
        this.logger.error('VideoRoomListenerJanusPlugin, unknown error sending answer', err, answer)
        reject(err)
      })
    })
  }

  candidate (candidate) {
    if (this.filterDirectCandidates && candidate.candidate && this.sdpHelper.isDirectCandidate(candidate.candidate)) {
      return
    }

    return this.transaction('trickle', { candidate })
  }

  hangup () {
    super.hangup()
    this.janus.destroyPlugin(this).catch((err) => {
      this.logger.error('VideoRoomListenerJanusPlugin, destroyPlugin error in hangup', err)
    })
  }

  onmessage (data, json) {
    const { videoroom } = data || {}

    if (!data || !videoroom) {
      this.logger.error('VideoRoomListenerJanusPlugin got unknown message', json)
      return
    }

    if (videoroom === 'slow_link') {
      this.logger.debug('VideoRoomListenerJanusPlugin got slow_link', data)
      this.slowLink()
      return
    }

    this.logger.error('VideoRoomListenerJanusPlugin unhandled message:', videoroom, json)
  }
}

module.exports = VideoRoomListenerJanusPlugin
