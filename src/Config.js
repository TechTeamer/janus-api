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
      bitrateCap,
      firSeconds,
      publishers,
      recordDirectory,
      isPrivate,
      secret,
      pin,
      requirePvtid,
      audioCodec,
      vp9Profile,
      h264Profile,
      opusFec,
      videoSvc,
      audiolevelExt,
      audiolevelEvent,
      audioActivePackets,
      audioLevelAverage,
      playoutDelayExt,
      transportWideCcExt,
      lockRecord,
      notifyJoining,
      requireE2ee
    } = config

    this.id = id
    this.codec = codec
    this.record = record
    this.videoOrientExt = videoOrientExt
    this.bitrate = bitrate
    this.bitrateCap = bitrateCap
    this.firSeconds = firSeconds
    this.publishers = publishers
    this.recordDirectory = recordDirectory
    this.isPrivate = isPrivate
    this.secret = secret
    this.pin = pin
    this.requirePvtid = requirePvtid
    this.audioCodec = audioCodec
    this.vp9Profile = vp9Profile
    this.h264Profile = h264Profile
    this.opusFec = opusFec
    this.videoSvc = videoSvc
    this.audiolevelExt = audiolevelExt
    this.audiolevelEvent = audiolevelEvent
    this.audioActivePackets = audioActivePackets
    this.audioLevelAverage = audioLevelAverage
    this.playoutDelayExt = playoutDelayExt
    this.transportWideCcExt = transportWideCcExt
    this.lockRecord = lockRecord
    this.notifyJoining = notifyJoining
    this.requireE2ee = requireE2ee
  }

  toJanusConfig () {
    const body = {
      description: '' + this.id
    }

    if (this.isPrivate) { // default: false
      body.is_private = this.isPrivate
    }

    if (this.secret) {
      body.secret = this.secret
    }

    if (this.pin) {
      body.pin = this.pin
    }

    if (this.requirePvtid) { // default: false
      body.require_pvtid = this.requirePvtid
    }

    if (this.publishers) {
      body.publishers = this.publishers
    }

    if (this.bitrate) {
      body.bitrate = this.bitrate
    }

    if (this.bitrateCap) { // default: false
      body.bitrate_cap = this.bitrateCap
    }

    if (this.firSeconds) {
      body.fir_freq = this.firSeconds
    }

    if (this.audioCodec) {
      body.audiocodec = this.audioCodec
    }

    if (this.codec) {
      body.videocodec = this.codec
    }

    if (this.vp9Profile) {
      body.vp9_profile = this.vp9Profile
    }

    if (this.h264Profile) {
      body.h264_profile = this.h264Profile
    }

    if (this.opusFec) { // default: false
      body.opus_fec = this.opusFec
    }

    if (this.videoSvc) { // default: false
      body.video_svc = this.videoSvc
    }

    if (this.audiolevelExt !== undefined) { // default: true
      body.audiolevel_ext = this.audiolevelExt
    }

    if (this.audiolevelEvent) { // default: false
      body.audiolevel_event = this.audiolevelEvent
    }

    if (this.audioActivePackets) {
      body.audio_active_packets = this.audioActivePackets
    }

    if (this.audioLevelAverage) {
      body.audio_level_average = this.audioLevelAverage
    }

    if (this.videoOrientExt !== undefined) { // default: true
      body.videoorient_ext = this.videoOrientExt
    }

    if (this.playoutDelayExt !== undefined) { // default: true
      body.playoutdelay_ext = this.playoutDelayExt
    }

    if (this.transportWideCcExt !== undefined) { // default: true
      body.transport_wide_cc_ext = this.transportWideCcExt
    }

    if (this.record) { // default: false
      body.record = this.record
    }

    if (this.recordDirectory) {
      body.rec_dir = this.recordDirectory
    }

    if (this.lockRecord) { // default: false
      body.lock_record = this.lockRecord
    }

    if (this.notifyJoining) { // default: false
      body.notify_joining = this.notifyJoining
    }

    if (this.requireE2ee) { // default: false
      body.require_e2ee = this.requireE2ee
    }

    return body
  }
}

module.exports.JanusConfig = JanusConfig
module.exports.JanusAdminConfig = JanusAdminConfig
module.exports.JanusRoomConfig = JanusRoomConfig
