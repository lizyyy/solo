const path = require('path');

module.exports = {
  port: process.env.PORT || 3000,
  db: {
    path: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'webhook.db'),
  },
  signature: {
    algorithm: 'sha256',
    header: 'X-Webhook-Signature',
    prefix: 'sha256=',
  },
  retry: {
    maxAttempts: 5,
    intervals: [1000, 5000, 15000, 30000, 60000],
    cronExpression: '*/10 * * * * *',
  },
  idempotency: {
    header: 'X-Idempotency-Key',
    ttlSeconds: 86400,
  },
  export: {
    defaultFormat: 'json',
  },
};