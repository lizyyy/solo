const EXIT_CODES = {
  SUCCESS: 0,
  NO_CONFLICTS: 0,
  CONFLICTS_FOUND: 1,
  INVALID_INPUT: 2,
  FILE_NOT_FOUND: 3,
  PARSE_ERROR: 4,
  PROCESSING_ERROR: 5,
  CANCELLED_EVENTS: 6
};

const EVENT_STATUS = {
  CONFIRMED: 'CONFIRMED',
  TENTATIVE: 'TENTATIVE',
  CANCELLED: 'CANCELLED'
};

const CONFLICT_TYPES = {
  OVERLAP: 'overlap',
  BACK_TO_BACK: 'back_to_back',
  CROSS_DAY: 'cross_day',
  CANCEL_NOT_EFFECTIVE: 'cancel_not_effective',
  HIDDEN_CONFLICT: 'hidden_conflict'
};

const OUTPUT_FORMATS = {
  JSON: 'json',
  MARKDOWN: 'markdown',
  ALL: 'all'
};

const TIME_UNITS = {
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000
};

module.exports = {
  EXIT_CODES,
  EVENT_STATUS,
  CONFLICT_TYPES,
  OUTPUT_FORMATS,
  TIME_UNITS
};
