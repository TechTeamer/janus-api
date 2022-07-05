/* eslint-disable no-console, no-undef, no-unused-vars */

const adapter = require('webrtc-adapter')
const common = require('../common')

const EchoJanusPlugin = require('../../src/plugin/EchoJanusPlugin')
const Janus = require('../../src/Janus')

const janus = new Janus(common.janus, console)

janus.connect().then(() => {
  console.log('Janus connected')

  const echo = new EchoJanusPlugin(console, false)

  return janus.addPlugin(echo).then(() => {
    console.log('EchoJanusPlugin added')

    return echo.connect().then(() => {
      console.log('EchoJanusPlugin connected')

      const peerConnection = new RTCPeerConnection(common.peerConnectionConfig)

      peerConnection.onicecandidate = (event) => {
        if (!event.candidate || !event.candidate.candidate) {
          echo.consume({ type: 'candidate', message: { completed: true } })
        } else {
          const candidate = {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex
          }
          echo.consume({ type: 'candidate', message: candidate })
        }
      }

      peerConnection.onaddstream = (mediaStreamEvent) => {
        console.log('GOT STREAM', mediaStreamEvent)

        const videoElement = document.getElementById('video')
        videoElement.srcObject = mediaStreamEvent.stream
        videoElement.play()
      }

      echo.on('jsep', (jsep) => {
        console.log('GOT answer from EchoJanusPlugin', jsep)

        peerConnection.setRemoteDescription(new RTCSessionDescription(jsep)).then(() => {
          console.log('remoteDescription set')
        })
      })

      return navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then((stream) => {
        console.log('getUserMedia got stream')

        peerConnection.addStream(stream)

        return peerConnection.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true }).then((offer) => {
          console.log('got offer', offer)

          return peerConnection.setLocalDescription(offer).then(() => {
            console.log('setlocalDescription')
            const jsep = { type: offer.type, sdp: offer.sdp }

            echo.consume({ type: 'message', message: { jsep } })
          })
        })
      })
    })
  })
}).catch(err => {
  console.log(err)
})
