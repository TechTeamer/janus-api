/* eslint-disable no-console, no-undef, no-unused-vars */

const adapter = require('webrtc-adapter')
const common = require('../common')

const VideoRoomPublisherJanusPlugin = require('../../src/plugin/VideoRoomPublisherJanusPlugin')
const Janus = require('../../src/Janus')

let janus = new Janus(common.janus, console)

janus.connect().then(() => {
  console.log('Janus connected')

  let publisher = new VideoRoomPublisherJanusPlugin(1, 'vp8', false, 'operator', common, console, false)

  return janus.addPlugin(publisher).then(() => {
    console.log('VideoRoomPublisherJanusPlugin added')

    return publisher.connect().then(() => {
      console.log('VideoRoomPublisherJanusPlugin connected')

      document.getElementById('janusRoomId').value = publisher.janusRoomId
      document.getElementById('janusRoomPrivateMemberId').value = publisher.janusRoomPrivateMemberId
      document.getElementById('janusRoomMemberId').value = publisher.janusRoomMemberId
      document.getElementById('start').href = `listener.html?janusRoomId=${publisher.janusRoomId}&janusRoomPrivateMemberId=${publisher.janusRoomPrivateMemberId}&janusRoomMemberId=${publisher.janusRoomMemberId}`

      let peerConnection = new RTCPeerConnection(common.peerConnectionConfig)

      peerConnection.onicecandidate = (event) => {
        if (!event.candidate || !event.candidate.candidate) {
          publisher.candidate({ completed: true })
        } else {
          let candidate = {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex
          }
          publisher.candidate(candidate)
        }
      }

      return navigator.mediaDevices.getUserMedia({audio: true, video: true}).then((stream) => {
        console.log('getUserMedia got stream')

        peerConnection.addStream(stream)

        let videoElement = document.getElementById('video')
        videoElement.srcObject = stream
        videoElement.play()

        return peerConnection.createOffer({}).then((offer) => {
          console.log('got offer', offer)

          return peerConnection.setLocalDescription(offer).then(() => {
            console.log('setLocalDescription')
            let jsep = { type: offer.type, sdp: offer.sdp }
            publisher.configure(jsep).then((jsep) => {
              console.log('ANSWER', jsep)
              peerConnection.setRemoteDescription(new RTCSessionDescription(jsep)).then(() => {
                console.log('remoteDescription set')
              })
            })
          })
        })
      })
    })
  })
}).catch(err => {
  console.log(err)
})
