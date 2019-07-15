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
   * Type param can be: rtp, rtsp, live, ondemand
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
    const body = Object.assign(parameters, { request: 'create' })

    return this.transaction('message', { body }, 'success').then(({ data, json }) => {
      if (data.error_code) {
        this.logger.error('StreamingJanusPlugin error while create', data)
        throw new Error('StreamingJanusPlugin error while create')
      }
      return { data, json }
    }).catch((err) => {
      this.logger.error('StreamingJanusPlugin, cannot create stream', err)
      throw err
    })
  }

  destroy (id, permanent = false) {
    const body = { request: 'destroy', id, permanent }

    return this.transaction('message', { body }, 'success').catch((err) => {
      this.logger.error('StreamingJanusPlugin, cannot destroy stream', err)
      throw err
    })
  }

  list () {
    const body = { request: 'list' }

    return this.transaction('message', { body }, 'success').catch((err) => {
      this.logger.error('StreamingJanusPlugin, cannot list streams', err)
      throw err
    })
  }

  watch (id) {
    const body = { request: 'watch', id }

    return new Promise((resolve, reject) => {
      this.transaction('message', { body }, 'event').then((param) => {
        const { data, json } = param || {}

        if (!data || data.streaming !== 'event') {
          this.logger.error('StreamingJanusPlugin watch error ', data, json)
          throw new Error('StreamingJanusPlugin watch error')
        }
        if (!json.jsep) {
          this.logger.error('StreamingJanusPlugin watch answer does not contains jsep', data, json)
          throw new Error('StreamingJanusPlugin watch answer does not contains jsep')
        }

        if (data.result && data.result.status) {
          this.emit('statusChange', data.result.status)
        }

        const jsep = json.jsep
        if (this.filterDirectCandidates && jsep.sdp) {
          jsep.sdp = this.sdpHelper.filterDirectCandidates(jsep.sdp)
        }

        this.emit('jsep', jsep)
        resolve(jsep)
      }).catch((err) => {
        this.logger.error('StreamingJanusPlugin, cannot watch stream', err)
        reject(err)
      })
    })
  }

  start (jsep) {
    const body = { request: 'start' }
    const message = { body }
    if (jsep) {
      message.jsep = jsep
    }

    return this.transaction('message', message, 'event').then(({ data, json }) => {
      if (data.result && data.result.status) {
        this.emit('statusChange', data.result.status)
      }
      return { data, json }
    }).catch((err) => {
      this.logger.error('StreamingJanusPlugin, cannot start stream', err)
      throw err
    })
  }

  stop () {
    const body = { request: 'stop' }

    return this.transaction('message', { body }, 'event').then(({ data, json }) => {
      if (data.result && data.result.status) {
        this.emit('statusChange', data.result.status)
      }
      return { data, json }
    }).catch((err) => {
      this.logger.error('StreamingJanusPlugin, cannot start stream', err)
      throw err
    })
  }

  pause () {
    const body = { request: 'pause' }

    return this.transaction('message', { body }, 'event').then(({ data, json }) => {
      if (data.result && data.result.status) {
        this.emit('statusChange', data.result.status)
      }
      return { data, json }
    }).catch((err) => {
      this.logger.error('StreamingJanusPlugin, cannot start stream', err)
      throw err
    })
  }

  info (id) {
    const body = { request: 'info', id }

    return this.transaction('message', { body }, 'success').catch((err) => {
      this.logger.error('StreamingJanusPlugin, cannot start stream', err)
      throw err
    })
  }

  switch (id) {
    const body = { request: 'switch', id }

    return this.transaction('message', { body }, 'event').catch((err) => {
      this.logger.error('StreamingJanusPlugin, cannot start stream', err)
      throw err
    })
  }

  onmessage (data, json) {
    if (data && data.streaming === 'event' && data.result && data.result.status) {
      this.emit('statusChange', data.result.status)
    } else {
      this.logger.error('StreamingJanusPlugin got unknown message', data, json)
    }
  }

  candidate (candidate) {
    if (this.filterDirectCandidates && candidate.candidate && this.sdpHelper.isDirectCandidate(candidate.candidate)) {
      return
    }

    return this.transaction('trickle', { candidate })
  }
}

module.exports = StreamingJanusPlugin
