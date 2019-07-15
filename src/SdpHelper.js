const SDPUtils = require('sdp')

class SdpHelper {
  constructor (logger) {
    this.logger = logger
  }

  /**
   * @param sdp string
   * @param allowedProfiles array[]|string|Regexp
   */
  filterH264Profiles (sdp, allowedProfiles) {
    const sections = SDPUtils.splitSections(sdp)

    const ret = []
    for (const section of sections) {
      if (SDPUtils.getMid(section) === 'video') {
        const newSection = []
        const lines = SDPUtils.splitLines(section)
        const rtpSections = [[]]
        let i = 0

        for (const line of lines) {
          if (line.indexOf('a=rtpmap:') === 0) {
            rtpSections.push([])
            i++
          }
          rtpSections[i].push(line)
        }

        rtpSections[0].map(l => newSection.push(l))
        for (let j = 1; j < rtpSections.length; j++) {
          const rtpSection = rtpSections[j]
          const parsed = SDPUtils.parseRtpMap(rtpSection[0])

          if (parsed && parsed.name === 'H264') {
            const fmtp = rtpSection.filter(l => l.indexOf('a=fmtp:') === 0).shift()

            let isAllowed = false
            if (Array.isArray(allowedProfiles)) {
              for (const allowedProfile of allowedProfiles) {
                isAllowed = isAllowed || fmtp.indexOf('profile-level-id=' + allowedProfile) !== -1
              }
            } else if (typeof allowedProfiles === 'string') {
              isAllowed = fmtp.indexOf('profile-level-id=' + allowedProfiles) !== -1
            } else if (allowedProfiles instanceof RegExp) {
              isAllowed = allowedProfiles.test(fmtp)
            }

            if (isAllowed) {
              rtpSections[j].map(l => newSection.push(l))
            }
          } else {
            rtpSections[j].map(l => newSection.push(l))
          }
        }

        newSection.map(l => ret.push(l))
      } else {
        SDPUtils.splitLines(section).map(l => ret.push(l))
      }
    }

    return ret.join('\r\n') + '\r\n'
  }

  filterDirectCandidates (sdp, force = false) {
    const lines = SDPUtils.splitLines(sdp)

    const ret = []
    let haveCandidates = false
    let haveNonDirectCandidates = false
    for (const line of lines) {
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
    const candidate = SDPUtils.parseCandidate(candidateLine)
    return candidate.type === 'host' || candidate.type === 'srflx' || candidate.tcpType === 'host' || candidate.tcpType === 'srflx'
  }
}

module.exports = SdpHelper
