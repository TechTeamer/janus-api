class JanusConfig {
  constructor (config) {
    const {
      url,
      keepAliveIntervalMs,
      options
    } = config

    this.url = url
    this.keepAliveIntervalMs = keepAliveIntervalMs
    this.options = options
  }
}

class JanusAdminConfig extends JanusConfig {
  constructor (config) {
    super(config)
    const {
      secret,
      sessionListIntervalMs
    } = config

    this.secret = secret
    this.sessionListIntervalMs = sessionListIntervalMs
  }
}

class JanusRoomConfig {
  constructor (config) {
    const {
      id,
      codec,
      record,
      videoOrientExt,
      bitrate,
      firSeconds,
      publishers,
      recordDirectory
    } = config

    this.id = id
    this.codec = codec
    this.record = record
    this.videoOrientExt = videoOrientExt
    this.bitrate = bitrate
    this.firSeconds = firSeconds
    this.publishers = publishers
    this.recordDirectory = recordDirectory
  }
}

module.exports.JanusConfig = JanusConfig
module.exports.JanusAdminConfig = JanusAdminConfig
module.exports.JanusRoomConfig = JanusRoomConfig
