/* eslint-disable no-console, no-undef, no-unused-vars */
const { JanusConfig } = require('../../src/Config')
const common = require('../common')
const janusConfig = new JanusConfig(common.janus)

const VideoCallPlugin = require('../../src/plugin/VideoCallPlugin')
const Janus = require('../../src/Janus')

const janus = new Janus(janusConfig, console)

function hangup () {
  document.getElementById('incomingDialog').style.display = 'none'
  const localvideo = document.getElementById('localvideo')
  localvideo.srcObject = null
  const remotevideo = document.getElementById('remotevideo')
  remotevideo.srcObject = null
}

/**
 * hangup and then register need remove dom listeners
 */
function removeDOMEvent () {
  const opertions = document.getElementsByTagName('button')
  Array.from(opertions).forEach(old => {
    if (old.id === 'register') {
      return
    }
    const newElement = old.cloneNode(true)
    old.parentNode.replaceChild(newElement, old)
  })
}

janus.connect().then(() => {
  document.getElementById('register').addEventListener('click', () => {
    console.log('Janus connected')
    const registerId = document.getElementById('registerId').value

    const videocall = new VideoCallPlugin(registerId, console, false)
    removeDOMEvent()
    return janus.addPlugin(videocall).then(() => {
      return videocall.register().then(() => {
        const peerConnection = new RTCPeerConnection(common.peerConnectionConfig)

        document.getElementById('hangup').addEventListener('click', () => {
          videocall.hangup()
        })

        videocall.on('hangup', () => {
          console.log('hangupppppppppp')
          hangup()
        })

        videocall.on('incomingcall', (username, jsep) => {
          document.getElementById('incomingDialog').style.display = 'block'
          // accepted
          document.getElementById('incoming-ok').addEventListener('click', () => {
            document.getElementById('incomingDialog').style.display = 'none'

            peerConnection
              .setRemoteDescription(new RTCSessionDescription(jsep))
              .then(() => {
                return peerConnection.createAnswer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
              })
              .then(answer => {
                peerConnection.setLocalDescription(new RTCSessionDescription(answer))
                videocall.doAnswer(answer)
              })
          })
          // hangup
          document.getElementById('incoming-cancle').addEventListener('click', () => {
            hangup()
            videocall.hangup()
          })
        })

        videocall.on('accepted', (username, jsep) => {
          peerConnection.setRemoteDescription(new RTCSessionDescription(jsep)).then(() => {})
        })

        peerConnection.onaddstream = mediaStreamEvent => {
          console.log('@onaddstream', mediaStreamEvent)

          const remotevideo = document.getElementById('remotevideo')
          remotevideo.srcObject = mediaStreamEvent.stream
          remotevideo.play()

          const localvideo = document.getElementById('localvideo')
          localvideo.play()
        }

        navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then(stream => {
          stream.getTracks().forEach(t => {
            peerConnection.addTrack(t)
          })

          // set local stream
          const localvideo = document.getElementById('localvideo')
          localvideo.srcObject = stream

          document.getElementById('call').addEventListener('click', () => {
            peerConnection.createOffer({}).then(offer => {
              const callId = document.getElementById('callId').value
              peerConnection.setLocalDescription(new RTCSessionDescription(offer)).then(() => {
                videocall.doCall(offer, callId)
              })
            })
          })
        })
      })
    })
  })
})
