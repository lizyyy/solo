const path = require('path');

module.exports = {
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0'
  },
  database: {
    path: process.env.DB_PATH || path.join(process.cwd(), 'slow_query.db'),
    journalMode: 'WAL'
  },
  fingerprint: {
    minLength: 10,
    maxLength: 10000
  },
  slowQuery: {
    defaultThreshold: 1000,
    batchSize: 100
  },
  task: {
    maxRetries: 3,
    retryDelay: 60000
  },
  log: {
    level: process.env.LOG_LEVEL || 'info',
    maxEntries: 10000
  }
};
