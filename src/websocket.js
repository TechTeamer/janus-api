/* eslint-disable no-undef, no-unused-vars */

try {
  const WebSocket = require('ws')
} catch (e) {
  // do nothing

  WebSocket.prototype.on = (event, callback) => {
    this['on' + event] = callback
  }

  WebSocket.prototype.once = (event, callback) =>  {
    this['on' + event] = () => {
      callback.apply(callback, arguments)
      this['on ' + event] = null
    }
  }

  WebSocket.prototype.off = (event, callback) => {
    this['on' + event] = callback
  }

  WebSocket.prototype.removeAllListeners = () => {
    //TODO
  }
}

module.exports = WebSocket
