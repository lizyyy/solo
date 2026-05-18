module.exports = {
  PORT: process.env.PORT || 3000,
  DB_PATH: './data/counseling.db',
  MAX_RESCHEDULE_TIMES: 3,
  RESCHEDULE_HOURS_BEFORE: 24
};
