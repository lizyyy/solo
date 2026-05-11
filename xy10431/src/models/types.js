const path = require('path');

const GOLDEN_HOURS = [
  { start: '07:00', end: '09:00' },
  { start: '12:00', end: '14:00' },
  { start: '18:00', end: '22:00' }
];

const PROBLEM_TYPES = {
  TITLE_DUPLICATE: 'title_duplicate',
  COVER_MISSING: 'cover_missing',
  SCHEDULE_CONFLICT: 'schedule_conflict',
  SENSITIVE_WORD: 'sensitive_word',
  GOLDEN_HOUR_CONSECUTIVE: 'golden_hour_consecutive',
  WAIVER_EXPIRED: 'waiver_expired'
};

const PROBLEM_STATUS = {
  OPEN: 'open',
  WAIVED: 'waived',
  RESOLVED: 'resolved'
};

const DATA_DIR = path.join(process.cwd(), '.wechat-publish');

module.exports = {
  GOLDEN_HOURS,
  PROBLEM_TYPES,
  PROBLEM_STATUS,
  DATA_DIR
};