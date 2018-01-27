/**
 *  This module is for mocking ws library in browsers
 */

let WebSocket

try {
  WebSocket = require('ws')
} catch (e) {
  // this is browser
  window.WebSocket.prototype.removeAllListeners = () => { }
}

module.exports = WebSocket || window.WebSocket
