const DEFAULT_CONFIG = {
  userKey: 'user_id',
  sessionKey: 'session_id',
  timeKey: 'timestamp',
  timeFormat: 'ms',
  gapThreshold: 30 * 60 * 1000,
  outputFormats: ['ndjson', 'csv', 'report'],
  encoding: 'utf8',
  bufferSize: 1000
};

const ERROR_CODES = {
  INPUT_INVALID: 'INPUT_INVALID',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  PARSE_ERROR: 'PARSE_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  IO_ERROR: 'IO_ERROR'
};

module.exports = { DEFAULT_CONFIG, ERROR_CODES };