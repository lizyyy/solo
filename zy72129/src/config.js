const path = require('path');

const config = {
  paths: {
    root: path.resolve(__dirname, '..'),
    audio: path.resolve(__dirname, '..', 'data', 'audio'),
    tracklists: path.resolve(__dirname, '..', 'data', 'tracklists'),
    notes: path.resolve(__dirname, '..', 'data', 'notes'),
    reports: path.resolve(__dirname, '..', 'reports'),
    output: path.resolve(__dirname, '..', 'output')
  },
  
  loudness: {
    targetLUFS: -16,
    toleranceLUFS: 2,
    minLUFS: -20,
    maxLUFS: -12,
    maxPeak: -1
  },
  
  review: {
    statuses: {
      PASS: '通过',
      NEEDS_REVIEW: '需人工确认',
      LEGACY: '旧口径',
      FAILED: '失败',
      PENDING: '待处理'
    }
  },
  
  supportedAudioFormats: ['.mp3', '.wav', '.m4a', '.aac', '.flac'],
  supportedTracklistFormats: ['.csv', '.xlsx', '.xls'],
  
  batch: {
    continueOnError: true,
    maxRetries: 1
  }
};

module.exports = config;
