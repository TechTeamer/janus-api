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

  /**
   * Type param can be: rtp, rtsp, live ondemand
   *
   * Common parameters:
   *   - id: positive integer, optional, random will be used if not present
   *   - name: string - optional
   *   - description: string - optional
   *   - audio: boolean - optional, default false
   *   - video: boolean - optional, default false
   *   - is_private: boolean, optional, default: false
   *   - pin
   *   - secret
   *   - permanent
   *
   * Plus parameters:
   *  - rtp:
   *     - data: boolean - optional, default false
   *     - collision
   *     - srtpsuite
   *     - srtpcrypto
   *
   *  - live: filename
   *  - ondemand: filename
   *  - rtsp: url, rtsp_user, rtsp_pwd, audiortpmap, audiofmtp, videortpmap, videofmtp, rtspiface
   *
   * @returns {Promise<T>}
   */
  create (parameters) {
    let body = Object.assign(parameters, { request: 'create' })

    return this.transaction('message', { body }, 'success').catch((err) => {
      this.logger.error('StreamingJanusPlugin, cannot create stream', err)
      throw err
    })
  }

  destroy (id, permanent = false) {
    let body = { request: 'destroy', id, permanent }

    return this.transaction('message', { body }, 'success').catch((err) => {
      this.logger.error('StreamingJanusPlugin, cannot destroy stream', err)
      throw err
    })
  }

  list () {
    let body = { request: 'list' }

    return this.transaction('message', { body }, 'success').catch((err) => {
      this.logger.error('StreamingJanusPlugin, cannot list streams', err)
      throw err
    })
  }

  watch () {

  }

  start () {

  }

  stop () {

  }
}

module.exports = StreamingJanusPlugin
