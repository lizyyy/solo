const crypto = require('crypto');

const SQL_PATTERNS = {
  numbers: /\b-?\d+(\.\d+)?\b/g,
  strings: /'[^']*'/g,
  doubleQuotedStrings: /"[^"]*"/g,
  hexValues: /\b0x[0-9a-fA-F]+\b/g,
  booleanValues: /\b(true|false|null)\b/gi,
  inClause: /IN\s*\([^)]+\)/gi,
  valuesClause: /VALUES\s*\([^)]+\)/gi,
  whitespace: /\s+/g,
  lineComments: /--[^\n]*/g,
  blockComments: /\/\*[\s\S]*?\*\//g,
};

function normalizeSQL(sql) {
  let normalized = sql;
  
  normalized = normalized.replace(SQL_PATTERNS.lineComments, ' ');
  normalized = normalized.replace(SQL_PATTERNS.blockComments, ' ');
  
  normalized = normalized.replace(SQL_PATTERNS.inClause, 'IN (...)');
  
  normalized = normalized.replace(SQL_PATTERNS.valuesClause, 'VALUES (...)');
  
  normalized = normalized.replace(SQL_PATTERNS.strings, '?');
  normalized = normalized.replace(SQL_PATTERNS.doubleQuotedStrings, '?');
  
  normalized = normalized.replace(SQL_PATTERNS.hexValues, '?');
  
  normalized = normalized.replace(SQL_PATTERNS.booleanValues, '?');
  
  normalized = normalized.replace(SQL_PATTERNS.numbers, '?');
  
  normalized = normalized.replace(SQL_PATTERNS.whitespace, ' ').trim();
  
  return normalized;
}

function generateFingerprint(normalizedSQL) {
  return crypto
    .createHash('md5')
    .update(normalizedSQL)
    .digest('hex');
}

function extractTableNames(sql) {
  const tables = new Set();
  const upperSQL = sql.toUpperCase();
  
  const fromMatches = upperSQL.match(/FROM\s+([^\s,;()]+)/gi);
  if (fromMatches) {
    fromMatches.forEach(match => {
      const table = match.replace(/^FROM\s+/i, '').trim();
      if (table && !table.startsWith('(')) {
        tables.add(cleanTableName(table));
      }
    });
  }
  
  const joinMatches = upperSQL.match(/JOIN\s+([^\s,;()]+)/gi);
  if (joinMatches) {
    joinMatches.forEach(match => {
      const table = match.replace(/^JOIN\s+/i, '').trim();
      if (table && !table.startsWith('(')) {
        tables.add(cleanTableName(table));
      }
    });
  }
  
  const updateMatches = upperSQL.match(/UPDATE\s+([^\s,;()]+)/gi);
  if (updateMatches) {
    updateMatches.forEach(match => {
      const table = match.replace(/^UPDATE\s+/i, '').trim();
      if (table) {
        tables.add(cleanTableName(table));
      }
    });
  }
  
  const insertMatches = upperSQL.match(/INTO\s+([^\s,;()]+)/gi);
  if (insertMatches) {
    insertMatches.forEach(match => {
      const table = match.replace(/^INTO\s+/i, '').trim();
      if (table) {
        tables.add(cleanTableName(table));
      }
    });
  }
  
  const deleteMatches = upperSQL.match(/DELETE\s+FROM\s+([^\s,;()]+)/gi);
  if (deleteMatches) {
    deleteMatches.forEach(match => {
      const table = match.replace(/^DELETE\s+FROM\s+/i, '').trim();
      if (table) {
        tables.add(cleanTableName(table));
      }
    });
  }
  
  return Array.from(tables).filter(t => t && !t.includes('?'));
}

function cleanTableName(table) {
  return table
    .replace(/['"`]/g, '')
    .replace(/^.*\./, '')
    .toLowerCase();
}

function extractQueryType(sql) {
  const upperSQL = sql.toUpperCase().trim();
  
  if (upperSQL.startsWith('SELECT')) return 'SELECT';
  if (upperSQL.startsWith('INSERT')) return 'INSERT';
  if (upperSQL.startsWith('UPDATE')) return 'UPDATE';
  if (upperSQL.startsWith('DELETE')) return 'DELETE';
  if (upperSQL.startsWith('CREATE')) return 'CREATE';
  if (upperSQL.startsWith('ALTER')) return 'ALTER';
  if (upperSQL.startsWith('DROP')) return 'DROP';
  if (upperSQL.startsWith('SET')) return 'SET';
  if (upperSQL.startsWith('SHOW')) return 'SHOW';
  
  return 'OTHER';
}

function processSQL(sql) {
  const normalized = normalizeSQL(sql);
  const fingerprint = generateFingerprint(normalized);
  const tables = extractTableNames(sql);
  const queryType = extractQueryType(sql);
  
  return {
    fingerprint,
    normalized,
    tables,
    queryType,
    original: sql
  };
}

module.exports = {
  normalizeSQL,
  generateFingerprint,
  extractTableNames,
  extractQueryType,
  processSQL
};
