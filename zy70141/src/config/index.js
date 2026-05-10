require('dotenv').config();

module.exports = {
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    env: process.env.NODE_ENV || 'development',
  },
  database: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    username: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'password',
    database: process.env.POSTGRES_DB || 'short_link_anti_fraud',
    dialect: 'postgres',
    pool: {
      max: 20,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  security: {
    deviceFingerprintSecret: process.env.DEVICE_FINGERPRINT_SECRET || 'default_secret',
    jwtSecret: process.env.JWT_SECRET || 'default_jwt_secret',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
  fraud: {
    frequencyThreshold: parseInt(process.env.FRAUD_FREQUENCY_THRESHOLD || '10', 10),
    timeWindowSeconds: parseInt(process.env.FRAUD_TIME_WINDOW_SECONDS || '60', 10),
    ipMaxRequests: parseInt(process.env.FRAUD_IP_MAX_REQUESTS || '50', 10),
    fingerprintSimilarityThreshold: parseFloat(
      process.env.FRAUD_FINGERPRINT_SIMILARITY_THRESHOLD || '0.9'
    ),
  },
  attribution: {
    windowHours: parseInt(process.env.ATTRIBUTION_WINDOW_HOURS || '24', 10),
  },
  retry: {
    maxAttempts: parseInt(process.env.RETRY_MAX_ATTEMPTS || '3', 10),
    delayMs: parseInt(process.env.RETRY_DELAY_MS || '1000', 10),
  },
};
