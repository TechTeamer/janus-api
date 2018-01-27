/* eslint-disable no-console, no-undef */
require('webrtc-adapter')
const common = require('../common')

const RecordPlayJanusPlugin = require('../../src/plugin/RecordPlayJanusPlugin')
const Janus = require('../../src/Janus')

let janus = null
/** @var RecordPlayJanusPlugin */
let record = null
let peerConnection = null

document.getElementById('stop').addEventListener('click', () => {
  record.consume({ type: 'stop' })
})

document.getElementById('configure').addEventListener('click', () => {
  record.configure(256 * 1024)
})

document.getElementById('start').addEventListener('click', () => {
  janus = new Janus(common.janus, console)
  janus.connect().then(() => {
    console.log('Janus connected')

    record = new RecordPlayJanusPlugin(console, false)

    return janus.addPlugin(record).then(() => {
      console.log('RecordPlayJanusPlugin added')

      peerConnection = new RTCPeerConnection(common.peerConnectionConfig)

      peerConnection.onicecandidate = (event) => {
        if (!event.candidate || !event.candidate.candidate) {
          record.consume({ type: 'candidate', message: { completed: true} })
        } else {
          let candidate = {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex
          }
          record.consume({ type: 'candidate', message: candidate })
        }
      }

      record.on('jsep', (jsep) => {
        console.log('GOT answer from RecordPlayJanusPlugin', jsep)

        peerConnection.setRemoteDescription(new RTCSessionDescription(jsep)).then(() => {
          console.log('remoteDescription set')
        })
      })

      return navigator.mediaDevices.getUserMedia({audio: true, video: true}).then((stream) => {
        console.log('getUserMedia got stream')

        peerConnection.addStream(stream)

        return peerConnection.createOffer({offerToReceiveAudio: false, offerToReceiveVideo: false}).then((offer) => {
          console.log('got offer', offer)

          return peerConnection.setLocalDescription(offer).then(() => {
            console.log('setlocalDescription')
            let jsep = { type: offer.type, sdp: offer.sdp }

            return record.consume({ type: 'message', message: { jsep: jsep } })
          })
        })
      })
    })
  }).catch(err => {
    console.log(err)
  })
})
