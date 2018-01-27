const JanusPlugin = require('../JanusPlugin')
const SdpHelper = require('../SdpHelper')

class EchoJanusPlugin extends JanusPlugin {
  constructor (logger, filterDirectCandidates = false) {
    super(logger)
    this.filterDirectCandidates = !!filterDirectCandidates
    this.janusEchoBody = { audio: true, video: true }
    this.pluginName = 'janus.plugin.echotest'
    this.sdpHelper = new SdpHelper(this.logger)
  }

  mute (isMuted = false) {
    return this.transaction('message', { audio: !isMuted }, 'success').catch((err) => {
      this.logger.error('EchoJanusPlugin, cannot mute', err)
      throw err
    })
  }

  connect () {
    return this.transaction('message', { body: this.janusEchoBody }, 'event').catch((err) => {
      this.logger.error('EchoJanusPlugin error during connect', err)
      throw err
    })
  }

  onmessage (data, json) {
    if (data && data.echotest === 'event' && data.result === 'done') {
      // okay, so the echo test has ended
      this.janus.destroyPlugin(this)
    } else {
      this.logger.error('EchoJanusPlugin got unknown message', data, json)
    }
  }

  consume (data) {
    if (data.type === 'message') {
      let sendData = { jsep: data.message.jsep, body: this.janusEchoBody }
      this.transaction('message', sendData, 'event').then((ret) => {
        let {json} = ret
        if (!json || !json.jsep) {
          this.logger.error('EchoJanusPlugin, no jsep in the transaction reply', ret)
          return
        }

        let jsep = json.jsep
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
    } else {
      this.logger.error('EchoTransportSession unknown data type', data)
    }
  }
}

module.exports = EchoJanusPlugin
