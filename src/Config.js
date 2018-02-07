class JanusConfig {
  constructor (config) {
    let {
      url,
      keepAliveIntervalMs,
      options,
      filterDirectCandidates,
      recordDirectory,
      replayDirectory,
      bitrate,
      firSeconds
    } = config

    this.janus = {}
    this.janus.url = url
    this.janus.keepAliveIntervalMs = keepAliveIntervalMs
    this.janus.options = options
    this.janus.filterDirectCandidates = filterDirectCandidates
    this.janus.recordDirectory = recordDirectory
    this.janus.replayDirectory = replayDirectory
    this.janus.bitrate = bitrate
    this.janus.firSeconds = firSeconds
  }
}

class JanusAdminConfig extends JanusConfig {
  constructor (janusConfig, adminConfig) {
    super(janusConfig)
    let {
      url,
      keepAliveIntervalMs,
      options,
      secret,
      sessionListIntervalMs
    } = adminConfig

    this.admin = {}
    this.admin.url = url
    this.admin.keepAliveIntervalMs = keepAliveIntervalMs
    this.admin.options = options
    this.admin.secret = secret
    this.admin.sessionListIntervalMs = sessionListIntervalMs
  }
}

module.exports.JanusConfig = JanusConfig
module.exports.JanusAdminConfig = JanusAdminConfig
