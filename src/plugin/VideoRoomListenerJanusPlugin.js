// const serviceContainer = require('../../service_container') // TODO: ?
const JanusPlugin = require('../JanusPlugin')

class VideoRoomListenerJanusPlugin extends JanusPlugin {
  constructor (roomId, janusRoomId, roomMemberPrivateId, mediaOptions, remoteFeedId, serviceContainer, filterDirectCandidates = false) {
    if (!roomId) {
      throw new Error('unknown roomId')
    }
    if (!roomMemberPrivateId) {
      throw new Error('unknown janusRoomPrivateMemberId')
    }

    super()
    this.roomId = roomId
    this.janusRoomId = janusRoomId
    this.pluginName = 'janus.plugin.videoroom'
    this.janusRoomPrivateMemberId = roomMemberPrivateId
    this.janusRemoteFeedId = remoteFeedId
    this.mediaOptions = mediaOptions
    this.filterDirectCandidates = !!filterDirectCandidates
    this.serviceContainer = serviceContainer
  }

  getAttachPayload () {
    let payload = super.getAttachPayload()
    if (this.mediaOptions && this.mediaOptions['force-bundle']) {
      payload['force-bundle'] = true
    }
    if (this.mediaOptions && this.mediaOptions['force-rtcp-mux']) {
      payload['force-rtcp-mux'] = true
    }

    return payload
  }

  join () {
    let join = { request: 'join', room: this.janusRoomId, ptype: 'listener', feed: this.janusRemoteFeedId, private_id: this.janusRoomPrivateMemberId }

    return new Promise((resolve, reject) => {
      this.transaction('message', {body: join}, 'event').then((param) => {
        let {data, json} = param || {}
        if (!data || data.videoroom !== 'attached') {
          this.serviceContainer.logger.error('VideoRoomListenerJanusPlugin join answer is not attached', data, json)
          throw new Error('VideoRoomListenerJanusPlugin join answer is not attached')
        }
        if (!json.jsep) {
          this.serviceContainer.logger.error('VideoRoomListenerJanusPlugin join answer does not contains jsep', data, json)
          throw new Error('VideoRoomListenerJanusPlugin join answer does not contains jsep')
        }

        let jsep = json.jsep
        if (this.filterDirectCandidates && jsep.sdp) {
          jsep.sdp = this.serviceContainer.sdpHelperService.filterDirectCandidates(jsep.sdp)
        }

        this.emit('jsep', jsep)
        resolve(jsep)
      }).catch((err) => {
        this.janus.logger.error('VideoRoomListenerJanusPlugin, unknown error connecting to room', err, join)
        reject(err)
      })
    })
  }

  setAnswer (answer) {
    let ans = { request: 'start', room: this.janusRoomId }

    return new Promise((resolve, reject) => {
      let jsep = answer
      if (this.filterDirectCandidates && jsep && jsep.sdp) {
        jsep.sdp = this.serviceContainer.sdpHelperService.filterDirectCandidates(jsep.sdp)
      }

      this.transaction('message', {body: ans, jsep}, 'event').then((param) => {
        let {data, json} = param || {}

        if (!data || data.started !== 'ok') {
          this.serviceContainer.logger.error('VideoRoomListenerJanusPlugin set answer is not ok', data, json)
          throw new Error('VideoRoomListenerJanusPlugin set answer is not ok')
        }
        resolve()
      }).catch((err) => {
        this.janus.logger.error('VideoRoomListenerJanusPlugin, unknown error sending answer', err, answer)
        reject(err)
      })
    })
  }

  candidate (candidate) {
    if (this.filterDirectCandidates && candidate.candidate && this.serviceContainer.sdpHelperService.isDirectCandidate(candidate.candidate)) {
      return
    }

    return this.transaction('trickle', { candidate })
  }
}

module.exports = VideoRoomListenerJanusPlugin
