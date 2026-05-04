module.exports = {
  server: {
    port: process.env.PORT || 3000,
    host: '0.0.0.0'
  },
  database: {
    path: process.env.DB_PATH || './data/rate-limit.db',
    journalMode: 'WAL'
  },
  rateLimit: {
    defaultAlgorithm: 'fixed-window',
    algorithms: ['fixed-window', 'sliding-window'],
    timePrecision: 'millisecond'
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableRequestLogging: true
  }
};
