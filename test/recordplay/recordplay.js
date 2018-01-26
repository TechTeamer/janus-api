/* eslint-disable no-console */

require('webrtc-adapter')
const common = require('../common')

const RecordPlayJanusPlugin = require('../../src/plugin/RecordPlayJanusPlugin')
const Janus = require('../../src/Janus')

let janus = new Janus(common.janus, console)

janus.connect().then(() => {
  console.log('Janus connected')

  let record = new RecordPlayJanusPlugin(console, false)

  return janus.addPlugin(record).then(() => {
    console.log('RecordPlayJanusPlugin added')
  })
}).catch(err => {
  console.log(err)
})
