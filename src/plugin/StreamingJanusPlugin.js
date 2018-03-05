const JanusPlugin = require('../JanusPlugin')
const SdpHelper = require('../SdpHelper')

class StreamingJanusPlugin extends JanusPlugin {
  constructor (logger, filterDirectCandidates = false) {
    super(logger)
    this.filterDirectCandidates = !!filterDirectCandidates
    this.janusEchoBody = { audio: true, video: true }
    this.pluginName = 'janus.plugin.streaming'
    this.sdpHelper = new SdpHelper(this.logger)
  }

  create () {

  }

  destroy () {

  }

  list () {

  }

  watch () {

  }

  start () {

  }

  stop () {

  }
}

module.exports = StreamingJanusPlugin
