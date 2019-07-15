const JanusPlugin = require('../JanusPlugin')
const SdpHelper = require('../SdpHelper')

class RecordPlayJanusPlugin extends JanusPlugin {
  constructor (logger, filterDirectCandidates = false) {
    super(logger)
    this.filterDirectCandidates = !!filterDirectCandidates
    this.janusEchoBody = { audio: true, video: true }
    this.pluginName = 'janus.plugin.recordplay'
    this.sdpHelper = new SdpHelper(this.logger)
  }

  configure (videoBitrateMax = 1024 * 1024, videoKeyframeInterval = 15000) {
    return this.transaction('message', { body: { request: 'configure', 'video-bitrate-max': videoBitrateMax, 'video-keyframe-interval': videoKeyframeInterval } }, 'success').catch((err) => {
      this.logger.error('RecordPlayJanusPlugin, cannot configure', err)
      throw err
    })
  }

  onmessage (data, json) {
    if (data && data.recordplay === 'event' && data.result === 'done') {
      // okay, so the recording has ended
      this.janus.destroyPlugin(this).catch((err) => {
        this.logger.error('RecordPlayJanusPlugin, destroyPlugin error in onmessage', err)
      })
    } else {
      this.logger.error('RecordPlayJanusPlugin got unknown message', data, json)
    }
  }

  consume (data) {
    if (data.type === 'message') {
      const sendData = { jsep: data.message.jsep, body: { request: 'record', name: 'hello' } }
      this.transaction('message', sendData, 'event').then((ret) => {
        const { json, data } = ret
        if (!data || !data.result || !data.result.id) {
          this.logger.error('RecordPlayJanusPlugin, no recording id in the transaction reply', ret)
          return
        }

        this.emit('recordingId', data.result.id)

        if (!json || !json.jsep) {
          this.logger.error('RecordPlayJanusPlugin, no jsep in the transaction reply', ret)
          return
        }

        const jsep = json.jsep
        if (this.filterDirectCandidates && jsep.sdp) {
          jsep.sdp = this.sdpHelper.filterDirectCandidates(jsep.sdp)
        }

        this.emit('jsep', jsep)
      })
    } else if (data.type === 'candidate') {
      if (this.filterDirectCandidates && data.message.candidate && this.sdpHelper.isDirectCandidate(data.message.candidate)) {
        return
      }
      this.transaction('trickle', { candidate: data.message })
    } else if (data.type === 'stop') {
      const sendData = { body: { request: 'stop' } }
      this.transaction('message', sendData, 'event')
    } else {
      this.logger.error('RecordPlayJanusPlugin unknown data type', data)
    }
  }
}

module.exports = RecordPlayJanusPlugin
