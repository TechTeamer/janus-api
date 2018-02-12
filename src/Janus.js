const WebSocket = require('./WebSocket')
const JanusPlugin = require('./JanusPlugin')
const uuid = require('uuid/v4')

class Janus {
  constructor (config, logger) {
    this.ws = undefined
    this.isConnected = false
    this.sessionId = undefined
    this.logger = logger

    this.transactions = {}
    this.pluginHandles = {}

    this.config = config
    this.protocol = 'janus-protocol'
    this.sendCreate = true
  }

  connect () {
    if (this.isConnected) {
      return Promise.resolve(this)
    }

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.config.url, this.protocol, this.config.options)

      this.ws.addEventListener('error', (err) => {
        this.logger.error('Error connecting to the Janus WebSockets server...', err)
        this.isConnected = false
        reject(err)
      })

      this.ws.addEventListener('close', () => { this.cleanup() })

      this.ws.addEventListener('open', () => {
        if (!this.sendCreate) {
          this.isConnected = true
          this.keepAlive(true)
          return resolve(this)
        }

        let transaction = uuid()
        let request = {janus: 'create', transaction}

        this.transactions[transaction] = {
          resolve: (json) => {
            if (json.janus !== 'success') {
              this.logger.error('Cannot connect to Janus', json)
              reject(json)
              return
            }

            this.sessionId = json.data.id
            this.isConnected = true
            this.keepAlive(true)

            this.logger.debug('Janus connected, sessionId: ', this.sessionId)

            resolve(this)
          },
          reject,
          replyType: 'success'
        }

        this.ws.send(JSON.stringify(request))
      })

      this.ws.addEventListener('message', (event) => { this.onMessage(event) })
      this.ws.addEventListener('close', () => { this.onClose() })
    })
  }

  /**
   *
   * @param {JanusPlugin} plugin
   * @return {Promise}
   * */
  addPlugin (plugin) {
    if (!(plugin instanceof JanusPlugin)) {
      return Promise.reject(new Error('plugin is not a JanusPlugin'))
    }

    let request = plugin.getAttachPayload()

    return this.transaction('attach', request, 'success').then((json) => {
      if (json['janus'] !== 'success') {
        this.logger.error('Cannot add plugin', json)
        plugin.error(json)
        throw new Error(json)
      }

      this.pluginHandles[json.data.id] = plugin

      return plugin.success(this, json.data.id)
    })
  }

  transaction (type, payload, replyType, timeoutMs) {
    if (!replyType) {
      replyType = 'ack'
    }
    let transactionId = uuid()

    return new Promise((resolve, reject) => {
      if (timeoutMs) {
        setTimeout(() => {
          reject(new Error('Transaction timed out after ' + timeoutMs + ' ms'))
        }, timeoutMs)
      }

      if (!this.isConnected) {
        reject(new Error('Janus is not connected'))
        return
      }

      let request = Object.assign({}, payload, {
        janus: type,
        session_id: (payload && parseInt(payload.session_id, 10)) || this.sessionId,
        transaction: transactionId
      })

      this.transactions[request.transaction] = {resolve, reject, replyType}
      this.ws.send(JSON.stringify(request))
    })
  }

  send (type, payload) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error('Janus is not connected'))
        return
      }

      let request = Object.assign({}, payload, {
        janus: type,
        session_id: this.sessionId,
        transaction: uuid()
      })

      this.logger.debug('Janus sending', request)
      this.ws.send(JSON.stringify(request), {}, (err) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }

  destroy () {
    if (!this.isConnected) {
      return Promise.resolve()
    }

    return this.transaction('destroy', {}, 'success', 5000).then(() => {
      this.cleanup()
    }).catch(() => {
      this.cleanup()
    })
  }

  destroyPlugin (plugin) {
    return new Promise((resolve, reject) => {
      if (!(plugin instanceof JanusPlugin)) {
        reject(new Error('plugin is not a JanusPlugin'))
        return
      }

      if (!this.pluginHandles[plugin.janusHandleId]) {
        reject(new Error('unknown plugin'))
        return
      }

      this.transaction('detach', {plugin: plugin.pluginName, handle_id: plugin.janusHandleId}, 'success', 5000).then(() => {
        delete this.pluginHandles[plugin.pluginName]
        plugin.detach()

        resolve()
      }).catch(reject)
    })
  }

  onMessage (messageEvent) {
    let json
    try {
      json = JSON.parse(messageEvent.data)
    } catch (err) {
      this.logger.error('cannot parse message', messageEvent.data)
      return
    }

    // this.logger.debug('JANUS GOT', json)
    if (json['janus'] === 'timeout' && json['session_id'] !== this.sessionId) {
      this.logger.debug('GOT timeout from another websocket') // seems like a bug in janus timeout handler :)
      return
    }

    if (json['janus'] === 'keepalive') { // Do nothing
      return
    }

    if (json['janus'] === 'ack') { // Just an ack, we can probably ignore
      let transaction = this.getTransaction(json)
      if (transaction && transaction.resolve) {
        transaction.resolve(json)
      }
      return
    }

    if (json['janus'] === 'success') { // Success!
      let transaction = this.getTransaction(json)
      if (!transaction) {
        return
      }

      let plugindata = json['plugindata']
      if (plugindata === undefined || plugindata === null) {
        transaction.resolve(json)
        return
      }

      let sender = json['sender']
      if (!sender) {
        transaction.resolve(json)
        this.logger.error('Missing sender for plugindata', json)
        return
      }

      let pluginHandle = this.pluginHandles[sender]
      if (!pluginHandle) {
        this.logger.error('This handle is not attached to this session', json)
        return
      }

      transaction.resolve({data: plugindata['data'], json})
      return
    }

    if (json['janus'] === 'webrtcup') { // The PeerConnection with the gateway is up! Notify this
      let sender = json['sender']
      if (!sender) {
        this.logger.warn('Missing sender...')
        return
      }
      let pluginHandle = this.pluginHandles[sender]
      if (!pluginHandle) {
        this.logger.error('This handle is not attached to this session', sender)
        return
      }
      pluginHandle.webrtcState(true)
      return
    }

    if (json['janus'] === 'hangup') { // A plugin asked the core to hangup a PeerConnection on one of our handles
      let sender = json['sender']
      if (!sender) {
        this.logger.warn('Missing sender...')
        return
      }
      let pluginHandle = this.pluginHandles[sender]
      if (!pluginHandle) {
        this.logger.error('This handle is not attached to this session', sender)
        return
      }
      pluginHandle.webrtcState(false, json['reason'])
      pluginHandle.hangup()
      return
    }

    if (json['janus'] === 'detached') { // A plugin asked the core to detach one of our handles
      let sender = json['sender']
      if (!sender) {
        this.logger.warn('Missing sender...')
        return
      }
      return
    }

    if (json['janus'] === 'media') { // Media started/stopped flowing
      let sender = json['sender']
      if (!sender) {
        this.logger.warn('Missing sender...')
        return
      }
      let pluginHandle = this.pluginHandles[sender]
      if (!pluginHandle) {
        this.logger.error('This handle is not attached to this session', sender)
        return
      }
      pluginHandle.mediaState(json['type'], json['receiving'])
      return
    }

    if (json['janus'] === 'slowlink') { // Trouble uplink or downlink
      this.logger.debug('Got a slowlink event on session ' + this.sessionId)
      this.logger.debug(json)
      let sender = json['sender']
      if (!sender) {
        this.logger.warn('Missing sender...')
        return
      }
      let pluginHandle = this.pluginHandles[sender]
      if (!pluginHandle) {
        this.logger.error('This handle is not attached to this session', sender)
        return
      }
      pluginHandle.slowLink(json['uplink'], json['nacks'])
      return
    }

    if (json['janus'] === 'error') { // Oops, something wrong happened
      if (!json.error || json.error.code !== 458) { // do not log 'No such session' errors ?
        this.logger.error('Ooops: ' + json['error'].code + ' ' + json['error'].reason)
        this.logger.debug(json)
      }
      let transaction = this.getTransaction(json, true)
      if (transaction && transaction.reject) {
        transaction.reject(json)
      }
      return
    }

    if (json['janus'] === 'event') {
      let sender = json['sender']
      if (!sender) {
        this.logger.warn('Missing sender...')
        return
      }
      let plugindata = json['plugindata']
      if (plugindata === undefined || plugindata === null) {
        this.logger.error('Missing plugindata...')
        return
      }

      let pluginHandle = this.pluginHandles[sender]
      if (!pluginHandle) {
        this.logger.error('This handle is not attached to this session', sender)
        return
      }

      let data = plugindata['data']
      let transaction = this.getTransaction(json)
      if (transaction) {
        if (data['error_code']) {
          transaction.reject({data, json})
        } else {
          transaction.resolve({data, json})
        }
        return
      }

      pluginHandle.onmessage(data, json)
      return
    }

    this.logger.warn('Unknown message/event ' + json['janus'] + ' on session ' + this.sessionId)
    this.logger.debug(json)
  }

  onClose () {
    if (!this.isConnected) {
      return
    }

    this.isConnected = false
    this.logger.error('Lost connection to the gateway (is it down?)')
  }

  keepAlive (isScheduled) {
    if (!this.ws || !this.isConnected || !this.sessionId) {
      return
    }

    if (isScheduled) {
      setTimeout(() => { this.keepAlive() }, this.config.keepAliveIntervalMs)
    } else {
      // logger.debug('Sending Janus keepalive')
      this.transaction('keepalive').then(() => {
        setTimeout(() => { this.keepAlive() }, this.config.keepAliveIntervalMs)
      })
    }
  }

  getTransaction (json, checkReplyType) {
    let type = json['janus']
    let transactionId = json['transaction']
    if (transactionId && this.transactions.hasOwnProperty(transactionId) && (checkReplyType || this.transactions[transactionId].replyType === type)) {
      let ret = this.transactions[transactionId]
      delete this.transactions[transactionId]
      return ret
    }
  }

  cleanup () {
    this._cleanupPlugins()
    this._cleanupWebSocket()
    this._cleanupTransactions()
  }

  _cleanupWebSocket () {
    if (this.ws) {
      this.ws.removeAllListeners()
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close()
      }
    }
    this.ws = undefined
    this.isConnected = false
  }

  _cleanupPlugins () {
    Object.keys(this.pluginHandles).forEach((pluginId) => {
      let plugin = this.pluginHandles[pluginId]
      delete this.pluginHandles[pluginId]
      plugin.detach()
    })
  }

  _cleanupTransactions () {
    Object.keys(this.transactions).forEach((transaction) => {
      if (transaction.reject) {
        transaction.reject()
      }
    })
    this.transactions = {}
  }
}

module.exports = Janus
