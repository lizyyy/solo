const path = require('path');

const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  db: {
    path: process.env.DB_PATH || path.join(__dirname, '../../data/loss_retry_queue.db'),
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  queue: {
    maxRetryTimes: parseInt(process.env.MAX_RETRY_TIMES || '3', 10),
    retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || '30000', 10),
  },
  upload: {
    dir: process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'),
  },
  export: {
    dir: process.env.EXPORT_DIR || path.join(__dirname, '../../exports'),
  },
};

module.exports = config;
