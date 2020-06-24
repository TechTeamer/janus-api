const { v4: uuid } = require('uuid')
const EventEmitter = require('events')

class JanusPlugin extends EventEmitter {
  constructor (logger) {
    super()
    this.id = uuid()
    /** @var Janus */
    this.janus = undefined
    this.janusHandleId = undefined
    this.pluginName = undefined
    this.logger = logger
  }

  getAttachPayload () {
    return { plugin: this.pluginName, opaque_id: this.id }
  }

  transaction (message, additionalFields, replyType) {
    const payload = Object.assign({}, additionalFields, { handle_id: this.janusHandleId })

    if (!this.janus) {
      return Promise.reject(new Error('JanusPlugin is not connected'))
    }

    return this.janus.transaction(message, payload, replyType)
  }

  success (janus, janusHandleId) {
    this.janus = janus
    this.janusHandleId = janusHandleId

    return this
  }

  error (cause) {
    // Couldn't attach to the plugin
  }

  onmessage (data, json) {
    this.logger.error('Unhandled message from janus in a plugin: ' + this.constructor.name, data, json)
  }

  oncleanup () {
    // PeerConnection with the plugin closed, clean the UI
    // The plugin handle is still valid so we can create a new one
  }

  detached () {
    // Connection with the plugin closed, get rid of its features
    // The plugin handle is not valid anymore
  }

  hangup () {
    this.emit('hangup')
  }

  slowLink () {
    this.emit('slowlink')
  }

  mediaState (medium, on) {
    this.emit('mediaState', medium, on)
  }

  webrtcState (isReady, cause) {
    this.emit('webrtcState', isReady, cause)
  }

  detach () {
    this.removeAllListeners()
    this.janus = null
  }
}

module.exports = JanusPlugin
