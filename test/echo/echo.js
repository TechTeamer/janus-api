/* eslint-disable no-console, no-undef */

const adapter = require('webrtc-adapter')
const common = require('../common')

const EchoJanusPlugin = require('../../src/plugin/EchoJanusPlugin')
const Janus = require('../../src/Janus')

let janus = new Janus(common.janus, console)

janus.connect().then(() => {
  console.log('Janus connected')

  let echo = new EchoJanusPlugin(console, false)

  return janus.addPlugin(echo).then(() => {
    console.log('EchoJanusPlugin added')

    return echo.connect().then(() => {
      console.log('EchoJanusPlugin connected')

      return navigator.mediaDevices.getUserMedia({audio: true, video: true}).then((stream) => {
        console.log('getUserMedia got stream')

        let peerConnection = new RTCPeerConnection(common.peerConnectionConfig)
        peerConnection.addStream(stream)

        return peerConnection.createOffer({offerToReceiveAudio: true, offerToReceiveVideo: true}).then((offer) => {
          console.log('got offer', offer)

          return peerConnection.setLocalDescription(offer).then(() => {
            console.log('setlocalDescription')
            let jsep = {type: offer.type, sdp: offer.sdp}

            echo.message({jsep})
          })
        })
      })
    })
  })
}).catch(err => {
  console.log(err)
})
