const db = require('../db');
const logger = require('./logger');

const EXCEPTION_TYPES = {
  INVALID_QUERY: 'invalid_query',
  FINGERPRINT_FAILED: 'fingerprint_failed',
  DB_ERROR: 'db_error',
  UNKNOWN_ERROR: 'unknown_error',
  VALIDATION_ERROR: 'validation_error',
  INTEGRITY_ERROR: 'integrity_error'
};

function recordException(type, source, rawData, errorMessage) {
  try {
    const exception = db.insert('exception_logs', {
      type,
      source,
      raw_data: typeof rawData === 'string' ? rawData : JSON.stringify(rawData),
      error_message: errorMessage,
      resolved: 0,
      resolved_by: null,
      resolved_at: null
    });
    
    logger.error(`Exception recorded [${type}]: ${errorMessage}`, { 
      exceptionId: exception.id,
      source 
    });
    
    return exception.id;
  } catch (e) {
    logger.error('Failed to record exception', { error: e.message });
    return null;
  }
}

function getUnresolvedExceptions() {
  return db.findAll('exception_logs', e => e.resolved === 0)
    .sort((a, b) => b.created_at - a.created_at);
}

function getExceptions(limit = 100) {
  return db.findAll('exception_logs')
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, limit);
}

function resolveException(exceptionId, resolverId, note) {
  const exception = db.findById('exception_logs', exceptionId);
  if (!exception) {
    throw new Error(`Exception ${exceptionId} not found`);
  }
  
  db.update('exception_logs', exceptionId, {
    resolved: 1,
    resolved_by: resolverId,
    resolved_at: db.now()
  });
  
  logger.info(`Exception ${exceptionId} resolved`, { resolverId, note });
  return true;
}

module.exports = {
  EXCEPTION_TYPES,
  recordException,
  getUnresolvedExceptions,
  getExceptions,
  resolveException
};
