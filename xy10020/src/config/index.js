require('dotenv').config();

const config = {
  port: process.env.PORT || 3000,
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  },
  database: {
    path: process.env.DATABASE_PATH || './data/live_push.db'
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'live_push_system_default_secret'
  },
  retry: {
    maxCount: parseInt(process.env.MAX_RETRY_COUNT) || 3,
    delayMs: parseInt(process.env.RETRY_DELAY_MS) || 1000
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
  }
};

module.exports = config;
