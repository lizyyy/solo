const crypto = require('crypto');
const config = require('../config');
const logger = require('./logger');

function normalizeSql(sql) {
  if (!sql || typeof sql !== 'string') {
    throw new Error('SQL must be a non-empty string');
  }
  
  let normalized = sql.trim();
  
  normalized = normalized.replace(/\s+/g, ' ');
  
  normalized = normalized.replace(/\n/g, ' ');
  normalized = normalized.replace(/\r/g, '');
  normalized = normalized.replace(/\t/g, ' ');
  
  normalized = normalized.replace(/--[^\n]*(\n|$)/g, '');
  normalized = normalized.replace(/\/\*[\s\S]*?\*\//g, '');
  
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  normalized = normalized.replace(/'[^']*'/g, "'?'");
  normalized = normalized.replace(/"[^"]*"/g, "\"?\"");
  
  normalized = normalized.replace(/\b\d+\b/g, '?');
  
  normalized = normalized.replace(/\bIN\s*\(\s*[\?,]\s*\)/gi, 'IN (...)');
  normalized = normalized.replace(/\bVALUES\s*\([^)]*\)/gi, 'VALUES (...)');
  
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  normalized = normalized.toUpperCase();
  
  if (normalized.length < config.fingerprint.minLength) {
    throw new Error('Normalized SQL too short');
  }
  
  if (normalized.length > config.fingerprint.maxLength) {
    logger.warn('SQL exceeds max length, truncating', { 
      originalLength: sql.length,
      normalizedLength: normalized.length 
    });
    normalized = normalized.substring(0, config.fingerprint.maxLength);
  }
  
  return normalized;
}

function computeFingerprintHash(normalizedSql) {
  return crypto
    .createHash('sha256')
    .update(normalizedSql)
    .digest('hex');
}

function generateFingerprint(rawSql) {
  const normalized = normalizeSql(rawSql);
  const hash = computeFingerprintHash(normalized);
  return {
    hash,
    normalized
  };
}

module.exports = {
  normalizeSql,
  computeFingerprintHash,
  generateFingerprint
};
