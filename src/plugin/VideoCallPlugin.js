const JanusPlugin = require('../JanusPlugin')
const SdpHelper = require('../SdpHelper')

class VideoCallPlugin extends JanusPlugin {
  constructor (display, logger, filterDirectCandidates = false) {
    super(logger)
    this.display = display
    this.pluginName = 'janus.plugin.videocall'
    this.filterDirectCandidates = !!filterDirectCandidates
    this.sdpHelper = new SdpHelper(this.logger)
  }

  /**
   * registered user list
   */
  onlineList () {
    const body = { request: 'list' }
    return this.transaction('message', { body }, 'event').then(data => {
      if (data.result && data.result.list) {
        return data.result.list
      }
      return []
    })
  }

  register () {
    const body = { request: 'register', username: this.display }
    return this.transaction('message', { body }, 'event').catch(err => {
      this.logger.error('VideoCallPlugin cant register', err)
      throw err
    })
  }

  doCall (jsep, callId) {
    const body = { request: 'call', username: callId }
    return this.transaction('message', { body, jsep }, 'event').catch(err => {
      this.logger.error('VideoCallPlugin cant call', err)
      throw err
    })
  }

  doAnswer (jsep) {
    const body = { request: 'accept' }
    return this.transaction('message', { body, jsep }, 'event').catch(err => {
      this.logger.error('VideoCallPlugin cant accept', err)
      throw err
    })
  }

  /**
   * @see https://janus.conf.meetecho.com/docs/videocall.html
   * @param {Object} set
   *  - "audio" : true|false,
   *  - "video" : true|false,
   *  - "bitrate" : <numeric bitrate value>,
   *  - "record" : true|false,
   *  - "filename" : <base path/filename to use for the recording>,
   *  - "substream" : <substream to receive (0-2), in case simulcasting is enabled>,
   *  - "temporal" : <temporal layers to receive (0-2), in case simulcasting is enabled>,
   *  - "fallback" : <How much time (in us, default 250000) without receiving packets will make us drop to the substream below>
   */
  configure (set) {
    const request = { request: 'set' }
    const body = Object.assign({}, request, set)
    return this.transaction('message', { body }, 'event')
  }

  hangup () {
    super.hangup()
    this.janus.destroyPlugin(this).catch(err => {
      this.logger.error('VideoRoomListenerJanusPlugin, destroyPlugin error in hangup', err)
    })
  }

  onmessage (data, json) {
    const { videocall } = data || {}

    if (!data || !videocall) {
      this.logger.error('VideoCallJanusPlugin got unknown message', json)
      return
    }

    if (videocall === 'event' && data.result && data.result.event) {
      const event = data.result.event

      if (event === 'accepted') {
        const { jsep } = json || {}
        this.emit('accepted', data.result.username, jsep)
      } else if (event === 'hangup') {
        // do from super
      } else if (event === 'incomingcall') {
        const { jsep } = json || {}
        this.emit('incomingcall', data.result.username, jsep)
      } else if (event === 'slow_link') {
        this.logger.debug('VideoCallJanusPlugin got slow_link', data)
        this.slowLink()
      } else {
        this.logger.error('VideoCallJanusPlugin got unknown event', json)
      }
    }
  }
}

module.exports = VideoCallPlugin
