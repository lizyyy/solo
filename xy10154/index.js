const Database = require('./src/database');
const LogisticsAnalyzer = require('./src/analyzer');
const Exporter = require('./src/exporter');
const {
  STATUS_TYPES,
  STATUS_NAMES,
  STATUS_TRANSITIONS,
  ANOMALY_TYPES,
  ANOMALY_NAMES,
  ANOMALY_SEVERITY,
  VALIDATION_RESULT
} = require('./src/constants');

const {
  parseDate,
  formatDate,
  generateHash,
  generateId,
  extractCity,
  normalizeLocation,
  isSameLocation
} = require('./src/utils');

const {
  isStatusTransitionValid,
  detectSignedBeforeCollect,
  detectCityJumps,
  detectDuplicateScans,
  detectTimeReversals,
  detectInvalidStatusTransitions,
  validatePackage
} = require('./src/validator');

module.exports = {
  Database,
  LogisticsAnalyzer,
  Exporter,
  STATUS_TYPES,
  STATUS_NAMES,
  STATUS_TRANSITIONS,
  ANOMALY_TYPES,
  ANOMALY_NAMES,
  ANOMALY_SEVERITY,
  VALIDATION_RESULT,
  parseDate,
  formatDate,
  generateHash,
  generateId,
  extractCity,
  normalizeLocation,
  isSameLocation,
  isStatusTransitionValid,
  detectSignedBeforeCollect,
  detectCityJumps,
  detectDuplicateScans,
  detectTimeReversals,
  detectInvalidStatusTransitions,
  validatePackage
};
