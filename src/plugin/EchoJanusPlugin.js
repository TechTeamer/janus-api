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
      this.janus.destroyPlugin(this).catch((err) => {
        this.logger.error('EchoJanusPlugin, destroyPlugin error in onmessage', err)
      })
    } else {
      this.logger.error('EchoJanusPlugin got unknown message', data, json)
    }
  }

  consume (data) {
    if (data.type === 'message') {
      const sendData = { jsep: data.message.jsep, body: this.janusEchoBody }
      return this.transaction('message', sendData, 'event').then((ret) => {
        const { json } = ret
        if (!json || !json.jsep) {
          this.logger.error('EchoJanusPlugin, no jsep in the transaction reply', ret)
          return
        }

        const jsep = json.jsep
        if (this.filterDirectCandidates && jsep.sdp) {
          jsep.sdp = this.sdpHelper.filterDirectCandidates(jsep.sdp)
        }

        this.emit('jsep', jsep)
      }).catch((err) => {
        this.logger.error('EchoJanusPlugin, message error in consume', err)
        throw err
      })
    } else if (data.type === 'candidate') {
      if (this.filterDirectCandidates && data.message.candidate && this.sdpHelper.isDirectCandidate(data.message.candidate)) {
        return Promise.resolve()
      }
      return this.transaction('trickle', { candidate: data.message }).catch((err) => {
        this.logger.error('EchoJanusPlugin, candidate error in consume', err)
        throw err
      })
    } else {
      this.logger.error('EchoTransportSession unknown data type', data)
      return Promise.reject(new Error('EchoTransportSession unknown data type'))
    }
  }
}

module.exports = EchoJanusPlugin
