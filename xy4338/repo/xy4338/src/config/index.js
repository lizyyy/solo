const path = require('path');

const config = {
  app: {
    name: '演出资料包巡检器',
    version: '1.0.0'
  },
  db: {
    path: process.env.INSPECT_DB_PATH || path.join(__dirname, '../../data/inspector.db')
  },
  server: {
    port: parseInt(process.env.INSPECT_PORT) || 3000,
    host: process.env.INSPECT_HOST || 'localhost'
  },
  validators: {
    voiceParts: ['女高', '女低', '男高', '男低'],
    allowedFileTypes: ['.pdf', '.mp3', '.wav', '.csv', '.xlsx', '.xls'],
    scorePatterns: [
      /^.*女高.*\.pdf$/i,
      /^.*女低.*\.pdf$/i,
      /^.*男高.*\.pdf$/i,
      /^.*男低.*\.pdf$/i
    ],
    maxWalkthroughTime: 3600,
    versionPattern: /v?(\d+\.\d+(\.\d+)?)/i
  }
};

module.exports = config;
