const path = require('path');

module.exports = {
  PORT: process.env.PORT || 8080,
  DB_PATH: process.env.DB_PATH || path.join(__dirname, '../data/database.db'),
  IDEMPOTENT_TTL: 24 * 60 * 60 * 1000,
  MAX_RETRY_COUNT: 5,
  RETRY_DELAY_BASE: 1000,
  DEFAULT_ASSIGNEE: '系统'
};
