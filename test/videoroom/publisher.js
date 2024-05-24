/* eslint-disable no-console, no-undef, no-unused-vars */
import 'webrtc-adapter'
import { JanusConfig, JanusRoomConfig } from '../../src/Config.js'
import common from '../common.js'
import VideoRoomPublisherJanusPlugin from '../../src/plugin/VideoRoomPublisherJanusPlugin.js'
import Janus from '../../src/Janus.js'
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
const janus = new Janus(janusConfig, console)

janus.connect().then(() => {
  console.log('Janus connected')

  const publisher = new VideoRoomPublisherJanusPlugin(roomConfig, 'operator', console, false)

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
      const bitrate = parseInt(document.getElementById('bitrate').value, 10)
      publisher.setRoomBitrate(bitrate).then((data) => {
        console.log('bitrate set to ' + bitrate, data)
      })
    })

    document.getElementById('start-rtp-button').addEventListener('click', () => {
      const host = document.getElementById('rtp-host').value
      const videoPort = parseInt(document.getElementById('rtp-video-port').value, 10)
      const audioPort = parseInt(document.getElementById('rtp-audio-port').value, 10)
      publisher.startRTPForward(host, videoPort, audioPort).then((data) => {
        console.log('RTP forwarded', data)
      })
    })

    document.getElementById('stop-rtp-button').addEventListener('click', () => {
      publisher.stopRTPForward()
    })

    return publisher.connect().then(() => {
      console.log('VideoRoomPublisherJanusPlugin connected')

      document.getElementById('janusRoomId').value = publisher.janusRoomId
      document.getElementById('janusRoomPrivateMemberId').value = publisher.janusRoomPrivateMemberId
      document.getElementById('janusRoomMemberId').value = publisher.janusRoomMemberId
      document.getElementById('start').href = `listener.html?janusRoomId=${publisher.janusRoomId}&janusRoomPrivateMemberId=${publisher.janusRoomPrivateMemberId}&janusRoomMemberId=${publisher.janusRoomMemberId}`

      const peerConnection = new RTCPeerConnection(common.peerConnectionConfig)

      peerConnection.onicecandidate = (event) => {
        if (!event.candidate || !event.candidate.candidate) {
          publisher.candidate({ completed: true })
        } else {
          const candidate = {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex
          }
          publisher.candidate(candidate)
        }
      }

      return navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then((stream) => {
        console.log('getUserMedia got stream')

        peerConnection.addStream(stream)

        return peerConnection.createOffer({}).then((offer) => {
          console.log('got offer', offer)

          return peerConnection.setLocalDescription(offer).then(() => {
            console.log('setLocalDescription')
            const jsep = { type: offer.type, sdp: offer.sdp }
            publisher.configure(jsep).then((jsep) => {
              console.log('ANSWER', jsep)
              peerConnection.setRemoteDescription(jsep).then(() => {
                console.log('remoteDescription set')
                const videoElement = document.getElementById('video')
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
