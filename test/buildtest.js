/* eslint-disable no-console */

import esbuild from 'esbuild'
import * as httpServer from 'http-server'
const pack = (input, output) => {
  esbuild.build({
    entryPoints: [input],
    bundle: true,
    outfile: output
  }).catch(err => {
    console.log(err)
  })
}

pack('./test/echo/echo.js', './test/echo/echo.bundle.js')
pack('./test/recordplay/recordplay.js', './test/recordplay/recordplay.bundle.js')
pack('./test/videoroom/publisher.js', './test/videoroom/publisher.bundle.js')
pack('./test/videoroom/listener.js', './test/videoroom/listener.bundle.js')
pack('./test/streaming/streaming.js', './test/streaming/streaming.bundle.js')
pack('./test/videocall/videocall.js', './test/videocall/videocall.bundle.js')

httpServer.createServer({
  showDir: true,
  root: './test/',
  https: {
    key: '/workspace/cert/dev.key',
    cert: '/workspace/cert/dev.crt'
  }
}).listen(8080)
