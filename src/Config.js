class JanusConfig {
  constructor (config) {
    let {
      url,
      keepAliveIntervalMs,
      options,
      filterDirectCandidates,
      recordDirectory,
      replayDirectory
    } = config

    this.url = url
    this.keepAliveIntervalMs = keepAliveIntervalMs
    this.options = options
    this.filterDirectCandidates = filterDirectCandidates
    this.recordDirectory = recordDirectory
    this.replayDirectory = replayDirectory
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

    this.url = url
    this.keepAliveIntervalMs = keepAliveIntervalMs
    this.options = options
    this.secret = secret
    this.sessionListIntervalMs = sessionListIntervalMs
  }
}

class JanusRoomConfig {
  constructor (config) {
    let {
      id,
      codec,
      record,
      videoOrientExt,
      bitrate,
      firSeconds,
      publishers
    } = config

    this.id = id
    this.codec = codec
    this.record = record
    this.videoOrientExt = videoOrientExt
    this.bitrate = bitrate
    this.firSeconds = firSeconds
    this.publishers = publishers
  }
}

module.exports.JanusConfig = JanusConfig
module.exports.JanusAdminConfig = JanusAdminConfig
module.exports.JanusRoomConfig = JanusRoomConfig
