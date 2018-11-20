/* eslint-disable no-console, no-undef, no-unused-vars */

const adapter = require('webrtc-adapter')
const { JanusConfig } = require('../../src/Config')
const common = require('../common')
const config = new JanusConfig(common.janus)

const VideoRoomListenerJanusPlugin = require('../../src/plugin/VideoRoomListenerJanusPlugin')
const Janus = require('../../src/Janus')

let janus = new Janus(config, console)

let params = (new URL(location.href)).searchParams

let janusRoomId
let janusRoomPrivateMemberId
let janusRoomMemberId

let startButton = document.getElementById('start')
startButton.onclick = connect

if (params.get('janusRoomId') && params.get('janusRoomPrivateMemberId') && params.get('janusRoomMemberId')) {
  document.getElementById('janusRoomId').value = params.get('janusRoomId')
  document.getElementById('janusRoomPrivateMemberId').value = params.get('janusRoomPrivateMemberId')
  document.getElementById('janusRoomMemberId').value = params.get('janusRoomMemberId')
  connect()
}

function connect () {
  janusRoomId = parseInt(document.getElementById('janusRoomId').value, 10)
  janusRoomPrivateMemberId = parseInt(document.getElementById('janusRoomPrivateMemberId').value, 10)
  janusRoomMemberId = parseInt(document.getElementById('janusRoomMemberId').value, 10)

  janus.connect().then(() => {
    console.log('Janus connected')

    let listener = new VideoRoomListenerJanusPlugin(1, janusRoomId, janusRoomPrivateMemberId, janusRoomMemberId, console, false)

    return janus.addPlugin(listener).then(() => {
      console.log('VideoRoomListenerJanusPlugin added')

      let peerConnection = new RTCPeerConnection(common.peerConnectionConfig)

      peerConnection.onicecandidate = (event) => {
        console.log('@onicecandidate', event)
        if (!event.candidate || !event.candidate.candidate) {
          listener.candidate({ completed: true })
        } else {
          let candidate = {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex
          }
          listener.candidate(candidate)
        }
      }

      peerConnection.onaddstream = (mediaStreamEvent) => {
        console.log('@onaddstream', mediaStreamEvent)

        let videoElement = document.getElementById('video')
        videoElement.srcObject = mediaStreamEvent.stream
        videoElement.play()
      }

      listener.on('jsep', (jsep) => {
        peerConnection.setRemoteDescription(new RTCSessionDescription(jsep)).then(() => {
          console.log('remoteDescription set')
          return peerConnection.createAnswer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
        }).then(answer => {
          console.log('answerCreated')
          peerConnection.setLocalDescription(answer)
          listener.setAnswer(answer)
        })
      })

      listener.on('hangup', () => {
        let videoElement = document.getElementById('video')
        videoElement.srcObject = null

        console.log('HANGUP')
      })

      return listener.join()
    })
  }).catch(err => {
    console.log(err)
  })
}
