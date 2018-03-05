/* eslint-disable no-console, no-undef, no-unused-vars */

const adapter = require('webrtc-adapter')
const { JanusConfig } = require('../../src/Config')
const common = require('../common')
const config = new JanusConfig(common.janus)

const StreamingJanusPlugin = require('../../src/plugin/StreamingJanusPlugin')
const Janus = require('../../src/Janus')

let listButton = document.getElementById('listButton')
let createButton = document.getElementById('createButton')
let listHolder = document.getElementById('listHolder')

let janus = new Janus(config, console)

janus.connect().then(() => {
  console.log('Janus connected')

  let streaming = new StreamingJanusPlugin(console, false)

  return janus.addPlugin(streaming).then(() => {
    createButton.removeAttribute('disabled')
    createButton.addEventListener('click', () => {
      let parameters = {
        type: 'rtp',
        audio: true,
        audioport: 8111,
        audiomcast: '127.0.0.1',
        audiopt: 111,
        audiortpmap: 'opus/48000',

        video: true,
        videoport: 8113,
        videomcast: '127.0.0.1',
        videopt: 96,
        videortpmap: 'VP8/90000'
      }

      streaming.create(parameters).then(({data, json}) => {
        console.log('CREATED', data, json)
        listButton.click()
      })
    })

    listButton.removeAttribute('disabled')
    listButton.addEventListener('click', () => {
      streaming.list().then(({data, json}) => {
        console.log('LIST', data)
        createStreamTable(data.list)
      })
    })

    document.addEventListener('click', (event) => {
      if (event.target && event.target.classList.contains('destroyActionLink')) {
        console.log('Destroy', event.target.dataset.id)

        streaming.destroy(Number.parseInt(event.target.dataset.id, 10)).then(({data, json}) => {
          console.log('DESTROYED', data, json)
          listButton.click()
        })
      } else if (event.target && event.target.classList.contains('startActionLink')) {
        console.log('Start', event.target.dataset.id)
      }
    })
  })
}).catch(err => {
  console.log(err)
})

function createStreamTable (streams) {
  listHolder.innerHTML = ''

  let table = document.createElement('div')
  table.classList.add('table')

  let thead = document.createElement('thead')
  table.appendChild(thead)
  let theadRow = document.createElement('tr')
  thead.appendChild(theadRow)
  let idHeadRow = document.createElement('th')
  idHeadRow.innerText = 'Id'
  theadRow.appendChild(idHeadRow)
  let typeHeadRow = document.createElement('th')
  typeHeadRow.innerText = 'type'
  theadRow.appendChild(typeHeadRow)
  let descriptionHeadRow = document.createElement('th')
  descriptionHeadRow.innerText = 'Description'
  theadRow.appendChild(descriptionHeadRow)
  let actionsHeadRow = document.createElement('th')
  actionsHeadRow.innerText = 'Actions'
  theadRow.appendChild(actionsHeadRow)

  let tbody = document.createElement('tbody')
  table.appendChild(tbody)

  streams.forEach((stream) => {
    let row = document.createElement('tr')

    let idCell = document.createElement('td')
    idCell.innerText = stream.id
    row.appendChild(idCell)
    let typeCell = document.createElement('td')
    typeCell.innerText = stream.type
    row.appendChild(typeCell)
    let descriptionCell = document.createElement('td')
    descriptionCell.innerText = stream.description
    row.appendChild(descriptionCell)

    let actionsCell = document.createElement('td')
    let destroyActionLink = document.createElement('button')
    destroyActionLink.classList.add('destroyActionLink', 'btn', 'btn-primary')
    destroyActionLink.dataset.id = stream.id
    destroyActionLink.innerText = 'Destroy'

    let startActionLink = document.createElement('button')
    startActionLink.classList.add('startActionLink', 'btn', 'btn-primary')
    startActionLink.dataset.id = stream.id
    startActionLink.innerText = 'Start'

    actionsCell.append(startActionLink)
    actionsCell.append(destroyActionLink)
    row.appendChild(actionsCell)

    tbody.appendChild(row)
  })

  listHolder.appendChild(table)
}
