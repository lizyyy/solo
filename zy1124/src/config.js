module.exports = {
  port: process.env.PORT || 3000,
  db: {
    path: process.env.DB_PATH || './data/webhook.db',
  },
  signature: {
    defaultAlgorithm: 'sha256',
    defaultTolerance: 300,
  },
  retry: {
    maxAttempts: 5,
    backoffMultiplier: 2,
    initialDelay: 10,
    scheduleInterval: 60,
  },
};
