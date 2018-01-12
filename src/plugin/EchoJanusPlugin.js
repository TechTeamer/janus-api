const serviceContainer = require('../../service_container')
const JanusPlugin = require('../JanusPlugin')

class EchoJanusPlugin extends JanusPlugin {
  constructor (filterDirectCandidates = false) {
    super()
    this.filterDirectCandidates = !!filterDirectCandidates
    this.janusEchoBody = { audio: true, video: true }
    this.pluginName = 'janus.plugin.echotest'
  }

  // TODO: test it
  mute (isMuted = false) {
    return this.transaction('message', { audio: !isMuted }, 'success').catch((err) => {
      this.janus.logger.error('EchoJanusPlugin, cannot mute', err)
      throw err
    })
  }

  connect () {
    return this.transaction('message', { body: this.janusEchoBody }, 'event').catch((err) => {
      serviceContainer.logger.error('EchoJanusPlugin error during connect', err)
      throw err
    })
  }

  onmessage (data, json) {
    if (data && data.echotest === 'event' && data.result === 'done') {
      // okay, so the echo test has ended
      this.janus.destroyPlugin(this)
    } else {
      serviceContainer.logger.error('EchoJanusPlugin got unknown message', data, json)
    }
  }

  consume (data) {
    if (data.type === 'message') {
      let sendData = { jsep: data.message.jsep, body: this.janusEchoBody }
      this.transaction('message', sendData, 'event').then((ret) => {
        let {json} = ret
        if (!json || !json.jsep) {
          serviceContainer.logger.error('EchoJanusPlugin, no jsep in the transaction reply', ret)
          return
        }

        let jsep = json.jsep
        if (this.filterDirectCandidates && jsep.sdp) {
          jsep.sdp = serviceContainer.sdpHelperService.filterDirectCandidates(jsep.sdp)
        }

        this.emit('jsep', jsep)
      })
    } else if (data.type === 'candidate') {
      if (this.filterDirectCandidates && data.message.candidate && serviceContainer.sdpHelperService.isDirectCandidate(data.message.candidate)) {
        return
      }
      this.transaction('trickle', { candidate: data.message })
    } else {
      serviceContainer.logger.error('EchoTransportSession unknown data type', data)
    }
  }
}

module.exports = EchoJanusPlugin
