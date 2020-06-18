const browserify = require('browserify')
const httpServer = require('http-server')
const fs = require('fs')

const pack = (input, output) => {
  browserify(input, { debug: true })
    .exclude(['ws'])
    .bundle((err, buf) => {
      if (err) {
        // eslint-disable-next-line no-console
        console.error(err)
        return
      }

      fs.writeFileSync(output, buf)
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
