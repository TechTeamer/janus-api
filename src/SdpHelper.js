const SDPUtils = require('sdp')

class SdpHelper {
  constructor (logger) {
    this.logger = logger
  }

  filterDirectCandidates (sdp, force = false) {
    let lines = SDPUtils.splitLines(sdp)

    let ret = []
    let haveCandidates = false
    let haveNonDirectCandidates = false
    for (let line of lines) {
      if (line.startsWith('a=candidate')) {
        haveCandidates = true
        if (!this.isDirectCandidate(line)) {
          ret.push(line)
          haveNonDirectCandidates = true
        }
      } else {
        ret.push(line)
      }
    }

    // only remove _all_ candidates if its a forced request
    if (haveCandidates && !haveNonDirectCandidates && !force) {
      this.logger.warn('SDP NO OTHER CANDIDATES THAN DIRECT CANDIDATES', sdp, new Error().stack)
      return sdp
    }

    if (haveCandidates && !haveNonDirectCandidates) {
      this.logger.error('SDP DIRECT CANDIDATES FILTERED OUT BUT NO OTHER CANDIDATES IN SDP', sdp, new Error().stack)
    }

    return ret.join('\r\n') + '\r\n'
  }

  isDirectCandidate (candidateLine) {
    let candidate = SDPUtils.parseCandidate(candidateLine)
    return candidate.type === 'host' || candidate.type === 'srflx' || candidate.tcpType === 'host' || candidate.tcpType === 'srflx'
  }
}

module.exports = SdpHelper
