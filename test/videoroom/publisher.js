/* eslint-disable no-console, no-undef, no-unused-vars */

const adapter = require('webrtc-adapter')
const { JanusConfig, JanusRoomConfig } = require('../../src/Config')
const common = require('../common')
const janusConfig = new JanusConfig(common.janus)
const roomConfig = new JanusRoomConfig({
  id: 1,
  codec: 'vp8,vp9,h264',
  record: true,
  videoOrientExt: false,
  bitrate: common.janus.bitrate,
  firSeconds: common.janus.firSeconds,
  publishers: common.janus.publishers,
  recordDirectory: common.janus.recordDirectory + '1/' // roomId
})

const VideoRoomPublisherJanusPlugin = require('../../src/plugin/VideoRoomPublisherJanusPlugin')
const Janus = require('../../src/Janus')

let janus = new Janus(janusConfig, console)

janus.connect().then(() => {
  console.log('Janus connected')

  let publisher = new VideoRoomPublisherJanusPlugin(roomConfig, 'operator', console, false)

  return janus.addPlugin(publisher).then(() => {
    console.log('VideoRoomPublisherJanusPlugin added')

    publisher.on('remoteMemberUnpublished', (data) => {
      console.log('remoteMemberUnpublished', data)
    })
    publisher.on('remoteMemberLeaving', (data) => {
      console.log('remoteMemberLeaving', data)
    })
    publisher.on('publishersUpdated', (data) => {
      console.log('publishersUpdated', data)
    })

    document.getElementById('bitrate-button').addEventListener('click', () => {
      let bitrate = parseInt(document.getElementById('bitrate').value, 10)
      publisher.setRoomBitrate(bitrate).then((data) => {
        console.log('bitrate set to ' + bitrate)
      })
    })

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

        return peerConnection.createOffer({}).then((offer) => {
          console.log('got offer', offer)

          return peerConnection.setLocalDescription(offer).then(() => {
            console.log('setLocalDescription')
            let jsep = { type: offer.type, sdp: offer.sdp }
            publisher.configure(jsep).then((jsep) => {
              console.log('ANSWER', jsep)
              peerConnection.setRemoteDescription(new RTCSessionDescription(jsep)).then(() => {
                console.log('remoteDescription set')

                let videoElement = document.getElementById('video')
                videoElement.srcObject = stream
                videoElement.play()
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
