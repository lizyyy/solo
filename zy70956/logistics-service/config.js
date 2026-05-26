module.exports = {
  PORT: process.env.PORT || 3000,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/logistics_service',
  OVERTIME_THRESHOLD_HOURS: 48,
  MALICIOUS_RATING: {
    MIN_INTERVAL_MS: 60000,
    MAX_RATINGS_PER_HOUR: 5
  },
  OPERATOR_DEFAULT: 'system_admin'
};
