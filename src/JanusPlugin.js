const uuid = require('uuid/v4')
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
    return {plugin: this.pluginName, opaque_id: this.id}
  }

  transaction (message, additionalFields, replyType) {
    let payload = Object.assign({}, additionalFields, { handle_id: this.janusHandleId })

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

  slowLink () {
    // this callback is triggered when Janus reports trouble either sending or receiving media
    // on the specified PeerConnection, typically as a consequence of too many NACKs received
    // from/sent to the user in the last second: for instance, a slowLink with uplink=true means
    // you notified several missing packets from Janus, while uplink=false means
    // Janus is not receiving all your packets; useful to figure out when there are problems
    // on the media path (e.g., excessive loss), in order to possibly react accordingly
    // (e.g., decrease the bitrate if most of our packets are getting lost);
  }

  mediaState (medium, on) {
    // console.log("Janus " + (on ? "started" : "stopped") + " receiving our " + medium)
  }

  webrtcState (isReady, cause) {
    // this callback is triggered with a true value when the PeerConnection associated
    // to a handle becomes active (so ICE, DTLS and everything else succeeded) from
    // the Janus perspective, while false is triggered when the PeerConnection goes down instead;
    // useful to figure out when WebRTC is actually up and running between you and Janus (
    // e.g., to notify a user they're actually now active in a conference); notice
    // that in case of false a reason string may be present as an optional parameter;
  }

  hangup () {
    // A plugin asked the core to hangup a PeerConnection on one of our handles
  }

  detach () {

  }
}

module.exports = JanusPlugin
