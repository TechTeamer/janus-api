const browserify = require('browserify')
const httpServer = require('http-server')
const fs = require('fs')

let pack = (input, output) => {
  browserify(input, {debug: true})
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

httpServer.createServer({
  showDir: true,
  root: './test/',
  https: {
    key: '/workspace/cert/dev.key',
    cert: '/workspace/cert/dev.crt'
  }
}).listen(8080)
