export const DEFAULT_CONFIG_FILE = '.env-checker.config.json';

export const EXIT_CODES = {
  SUCCESS: 0,
  ERRORS_FOUND: 1,
  CONFIG_ERROR: 2,
  SCAN_ERROR: 3,
};

export const ISSUE_TYPES = {
  MISSING_IN_EXAMPLE: 'missing_in_example',
  EXTRA_IN_LOCAL: 'extra_in_local',
  VALUE_CONFLICT: 'value_conflict',
  POTENTIAL_SECRET: 'potential_secret',
};

export const SECRET_PATTERNS = [
  /api[_-]?key/i,
  /secret/i,
  /password/i,
  /token/i,
  /credential/i,
  /private[_-]?key/i,
  /aws[_-]?access[_-]?key/i,
  /aws[_-]?secret/i,
  /db[_-]?pass/i,
  /database[_-]?password/i,
];

export const ENV_VAR_PATTERN = /\b([A-Z_][A-Z0-9_]*)\b/g;
