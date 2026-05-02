const path = require('path');

const config = {
  PORT: process.env.PORT || 3000,
  STORAGE_PATH: process.env.STORAGE_PATH || path.join(__dirname, '../../data'),
  
  WEBRTC: {
    ICE_TIMEOUT: 30000,
    CONNECTION_TIMEOUT: 60000,
    RECONNECT_ATTEMPTS: 3,
    RECONNECT_DELAY: 5000,
  },
  
  NETWORK_INJECTION: {
    MAX_LATENCY: 5000,
    MAX_PACKET_LOSS: 1.0,
    DEFAULT_DURATION: 10000,
  },
  
  VALIDATION_RULES: {
    NEGOTIATION_TIMEOUT: 10000,
    RECONNECT_TIMEOUT: 30000,
    RECORDING_GAP_THRESHOLD: 5000,
    AUDIO_TRACK_EXPECTED: true,
    VIDEO_TRACK_EXPECTED: false,
  },
  
  EXPORT: {
    MARKDOWN_TEMPLATE: path.join(__dirname, '../templates/report-template.md'),
  },
};

module.exports = config;
