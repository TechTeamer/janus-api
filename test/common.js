export const janus = {
  url: 'wss://localhost:8989',
  keepAliveIntervalMs: 30000,
  options: {
    rejectUnauthorized: false
  },
  filterDirectCandidates: true,
  recordDirectory: '/workspace/records/',
  bitrate: 774144,
  firSeconds: 10,
  publishers: 20
}
export const peerConnectionConfig = {
  iceServers: [
    { url: 'stun:turnserver.techteamer.com:443' },
    { username: 'demo', url: 'turn:turnserver.techteamer.com:443?transport=udp', credential: 'secret' },
    { username: 'demo', url: 'turn:turnserver.techteamer.com:443?transport=tcp', credential: 'secret' }
  ]
}
export default {
  janus,
  peerConnectionConfig
}
