/* eslint-disable no-console, no-undef, no-unused-vars */

import 'webrtc-adapter'
import { JanusConfig } from '../../src/Config.js'
import common from '../common.js'

import StreamingJanusPlugin from '../../src/plugin/StreamingJanusPlugin.js'
import Janus from '../../src/Janus.js'

const config = new JanusConfig(common.janus)

const listButton = document.getElementById('listButton')
const createButton = document.getElementById('createButton')
const listHolder = document.getElementById('listHolder')
const stopStreamButton = document.getElementById('stopStreamButton')
const pauseStreamButton = document.getElementById('pauseStreamButton')
const startStreamButton = document.getElementById('startStreamButton')

const janus = new Janus(config, console)
window.janus = janus

janus.connect().then(() => {
  console.log('Janus connected')

  const streaming = new StreamingJanusPlugin(console, false)
  window.streaming = streaming

  return janus.addPlugin(streaming).then(() => {
    createButton.removeAttribute('disabled')
    createButton.addEventListener('click', () => {
      const parameters = {
        type: 'rtp',
        audio: true,
        audioport: 8113,
        audiomcast: '127.0.0.1',
        audiopt: 111,
        audiortpmap: 'opus/48000/2',

        video: true,
        videoport: 8111,
        videomcast: '127.0.0.1',
        videopt: 96,
        videortpmap: 'VP8/90000'
      }

      streaming.create(parameters).then(({ data, json }) => {
        console.log('CREATED', data, json)
        listButton.click()
      })
    })
    stopStreamButton.addEventListener('click', () => {
      console.log('Stop')
      streaming.stop()
    })
    pauseStreamButton.addEventListener('click', () => {
      console.log('Pause')
      streaming.pause()
    })
    startStreamButton.addEventListener('click', () => {
      console.log('Start')
      streaming.start()
    })

    listButton.removeAttribute('disabled')
    listButton.addEventListener('click', () => {
      streaming.list().then(({ data, json }) => {
        console.log('LIST', data)
        createStreamTable(data.list)
      })
    })

    document.addEventListener('click', (event) => {
      if (event.target && event.target.classList.contains('destroyActionLink')) {
        streaming.destroy(Number.parseInt(event.target.dataset.id, 10)).then(({ data, json }) => {
          console.log('DESTROYED', data, json)
          listButton.click()
        })
      } else if (event.target && event.target.classList.contains('infoActionLink')) {
        console.log('Info', event.target.dataset.id)
        streaming.info(Number.parseInt(event.target.dataset.id, 10)).then(({ data, json }) => {
          console.log('INFO', data, json)
        })
      } else if (event.target && event.target.classList.contains('watchActionLink')) {
        console.log('Watch', event.target.dataset.id)
        stopStreamButton.dataset.id = event.target.dataset.id

        const peerConnection = new RTCPeerConnection(common.peerConnectionConfig)
        peerConnection.onicecandidate = (event) => {
          console.log('@onicecandidate', event)
          if (!event.candidate || !event.candidate.candidate) {
            streaming.candidate({ completed: true })
          } else {
            const candidate = {
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex
            }
            streaming.candidate(candidate)
          }
        }

        peerConnection.onaddstream = (mediaStreamEvent) => {
          console.log('@onaddstream', mediaStreamEvent)

          const videoElement = document.getElementById('video')
          videoElement.srcObject = mediaStreamEvent.stream
          videoElement.play()
        }

        streaming.watch(Number.parseInt(event.target.dataset.id, 10)).then((jsep) => {
          peerConnection.setRemoteDescription(new RTCSessionDescription(jsep)).then(() => {
            console.log('remoteDescription set')
            return peerConnection.createAnswer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
          }).then(answer => {
            console.log('answerCreated', answer)
            peerConnection.setLocalDescription(answer)

            streaming.start(answer).then(({ body, json }) => {
              console.log('START', body, json)
            })
          })
        })

        streaming.on('hangup', () => {
          const videoElement = document.getElementById('video')
          videoElement.srcObject = null

          console.log('HANGUP')
        })

        streaming.on('webrtcState', (a, b) => {
          console.log('webrtcState', a, b)
        })
        streaming.on('mediaState', (a, b) => {
          console.log('mediaState', a, b)
        })
        streaming.on('statusChange', (status) => {
          console.log('statusChange', status)
        })
      }
    })
  })
}).catch(err => {
  console.log(err)
})

function createStreamTable (streams) {
  listHolder.innerHTML = ''

  const table = document.createElement('div')
  table.classList.add('table')

  const thead = document.createElement('thead')
  table.appendChild(thead)
  const theadRow = document.createElement('tr')
  thead.appendChild(theadRow)
  const idHeadRow = document.createElement('th')
  idHeadRow.innerText = 'Id'
  theadRow.appendChild(idHeadRow)
  const typeHeadRow = document.createElement('th')
  typeHeadRow.innerText = 'type'
  theadRow.appendChild(typeHeadRow)
  const descriptionHeadRow = document.createElement('th')
  descriptionHeadRow.innerText = 'Description'
  theadRow.appendChild(descriptionHeadRow)
  const actionsHeadRow = document.createElement('th')
  actionsHeadRow.innerText = 'Actions'
  theadRow.appendChild(actionsHeadRow)

  const tbody = document.createElement('tbody')
  table.appendChild(tbody)

  streams.forEach((stream) => {
    const row = document.createElement('tr')

    const idCell = document.createElement('td')
    idCell.innerText = stream.id
    row.appendChild(idCell)
    const typeCell = document.createElement('td')
    typeCell.innerText = stream.type
    row.appendChild(typeCell)
    const descriptionCell = document.createElement('td')
    descriptionCell.innerText = stream.description
    row.appendChild(descriptionCell)

    const actionsCell = document.createElement('td')
    const destroyActionLink = document.createElement('button')
    destroyActionLink.classList.add('destroyActionLink', 'btn', 'btn-primary')
    destroyActionLink.dataset.id = stream.id
    destroyActionLink.innerText = 'Destroy'

    const infoActionLink = document.createElement('button')
    infoActionLink.classList.add('infoActionLink', 'btn', 'btn-primary')
    infoActionLink.dataset.id = stream.id
    infoActionLink.innerText = 'Info'

    const watchActionLink = document.createElement('button')
    watchActionLink.classList.add('watchActionLink', 'btn', 'btn-primary')
    watchActionLink.dataset.id = stream.id
    watchActionLink.innerText = 'Watch'

    actionsCell.appendChild(watchActionLink)
    actionsCell.appendChild(infoActionLink)
    actionsCell.appendChild(destroyActionLink)
    row.appendChild(actionsCell)

    tbody.appendChild(row)
  })

  listHolder.appendChild(table)
}
