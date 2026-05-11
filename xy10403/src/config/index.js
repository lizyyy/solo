module.exports = {
  PORT: process.env.PORT || 3001,
  JWT_SECRET: process.env.JWT_SECRET || 'park-access-secret-key-2024',
  JWT_EXPIRES_IN: '24h',
  CRON_SCHEDULE: '0 * * * *',
};
