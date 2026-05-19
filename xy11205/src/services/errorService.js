const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const { getDatabase } = require('../models/database');

function recordImportError(importType, sourceFile, rowNumber, rawData, errorMessage, suggestion = null) {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    INSERT INTO import_errors (id, import_type, source_file, row_number, raw_data, error_message, suggestion, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    uuidv4(),
    importType,
    sourceFile,
    rowNumber,
    typeof rawData === 'string' ? rawData : JSON.stringify(rawData),
    errorMessage,
    suggestion,
    dayjs().format('YYYY-MM-DD HH:mm:ss')
  );
}

function getImportErrors(options = {}) {
  const db = getDatabase();
  let query = 'SELECT * FROM import_errors WHERE 1=1';
  const params = [];
  
  if (options.importType) {
    query += ' AND import_type = ?';
    params.push(options.importType);
  }
  
  if (options.sourceFile) {
    query += ' AND source_file = ?';
    params.push(options.sourceFile);
  }
  
  if (options.resolved !== undefined) {
    query += ' AND resolved = ?';
    params.push(options.resolved ? 1 : 0);
  }
  
  query += ' ORDER BY created_at DESC';
  
  if (options.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
  }
  
  const stmt = db.prepare(query);
  return stmt.all(...params);
}

function resolveError(id, resolvedBy) {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    UPDATE import_errors 
    SET resolved = 1, resolved_at = ?, resolved_by = ?
    WHERE id = ?
  `);
  
  const result = stmt.run(
    dayjs().format('YYYY-MM-DD HH:mm:ss'),
    resolvedBy,
    id
  );
  
  return result.changes > 0;
}

module.exports = {
  recordImportError,
  getImportErrors,
  resolveError
};
