const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

module.exports = {
  app: {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    jwtSecret: process.env.JWT_SECRET || 'development-secret-key',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'seized_items_ledger',
    schema: process.env.DB_SCHEMA || 'public'
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || ''
  },

  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10),
    allowedTypes: (process.env.ALLOWED_FILE_TYPES || 'jpg,jpeg,png,gif').split(',')
  },

  log: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || './logs'
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10)
  },

  queue: {
    maxRetryAttempts: parseInt(process.env.QUEUE_MAX_RETRY_ATTEMPTS || '5', 10),
    backoffType: process.env.QUEUE_BACKOFF_TYPE || 'exponential',
    backoffDelay: parseInt(process.env.QUEUE_BACKOFF_DELAY || '1000', 10)
  }
};
