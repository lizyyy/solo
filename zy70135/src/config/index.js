require('dotenv').config();

const env = process.env.NODE_ENV || 'development';

module.exports = {
  env,
  port: parseInt(process.env.PORT, 10) || 3000,
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-key-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  log: {
    level: process.env.LOG_LEVEL || 'info',
  },
  blacklist: {
    maxReasonLength: 500,
    defaultShared: true,
  },
  exemption: {
    maxDurationDays: 90,
    minReviewDays: 7,
  },
  export: {
    maxRecordsPerExport: 10000,
  },
};
