const { run, all, get } = require('./database');
const config = require('../config');

async function createSession(sourceFile, sourceType, operator = config.defaultOperator, role = config.defaultRole) {
  const result = await run(
    'INSERT INTO import_sessions (source_file, source_type, operator, role) VALUES (?, ?, ?, ?)',
    [sourceFile, sourceType, operator, role]
  );
  return result.lastID;
}

async function updateSessionStats(sessionId, total, success, errors) {
  await run(
    'UPDATE import_sessions SET total_records = ?, success_count = ?, error_count = ?, status = ? WHERE id = ?',
    [total, success, errors, 'completed', sessionId]
  );
}

async function getSession(sessionId) {
  return get('SELECT * FROM import_sessions WHERE id = ?', [sessionId]);
}

async function getAllSessions() {
  return all('SELECT * FROM import_sessions ORDER BY import_time DESC');
}

async function insertBookRecord(sessionId, record, operator = config.defaultOperator, role = config.defaultRole) {
  const result = await run(
    `INSERT INTO book_records 
     (session_id, isbn, title, author, publisher, grade, condition, donor, remark, operator, role)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sessionId,
      record.isbn,
      record.title || '',
      record.author || '',
      record.publisher || '',
      record.grade,
      record.condition,
      record.donor || '',
      record.remark || '',
      operator,
      role
    ]
  );

  await logAudit(result.lastID, 'create', null, JSON.stringify(record), operator, role);
  return result.lastID;
}

async function insertErrorRecord(sessionId, rowNum, rawData, errors, operator = config.defaultOperator, role = config.defaultRole) {
  const errorMessages = errors.map(e => `${e.field}: ${e.message}`).join('; ');
  const suggestions = errors.map(e => `${e.field}: ${e.suggestion}`).join('; ');
  const errorTypes = [...new Set(errors.map(e => e.field))].join(',');

  const result = await run(
    `INSERT INTO error_records 
     (session_id, source_row, raw_data, error_type, error_message, suggestion, operator, role)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sessionId,
      rowNum,
      JSON.stringify(rawData),
      errorTypes,
      errorMessages,
      suggestions,
      operator,
      role
    ]
  );
  return result.lastID;
}

async function getBookRecords(sessionId = null, status = null) {
  let query = 'SELECT * FROM book_records WHERE 1=1';
  const params = [];

  if (sessionId) {
    query += ' AND session_id = ?';
    params.push(sessionId);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  query += ' ORDER BY created_at DESC';

  return all(query, params);
}

async function getErrorRecords(sessionId = null, isResolved = null) {
  let query = 'SELECT * FROM error_records WHERE 1=1';
  const params = [];

  if (sessionId) {
    query += ' AND session_id = ?';
    params.push(sessionId);
  }
  if (isResolved !== null) {
    query += ' AND is_resolved = ?';
    params.push(isResolved ? 1 : 0);
  }
  query += ' ORDER BY created_at DESC';

  return all(query, params);
}

async function updateBookStatus(bookId, status, operator = config.defaultOperator, role = config.defaultRole) {
  const oldRecord = await get('SELECT * FROM book_records WHERE id = ?', [bookId]);

  await run(
    'UPDATE book_records SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, bookId]
  );

  await logAudit(bookId, 'status_change', oldRecord ? oldRecord.status : null, status, operator, role);
}

async function resolveError(errorId, operator = config.defaultOperator, role = config.defaultRole) {
  await run(
    'UPDATE error_records SET is_resolved = 1, resolved_at = CURRENT_TIMESTAMP WHERE id = ?',
    [errorId]
  );
}

async function logAudit(recordId, action, oldValue, newValue, operator, role) {
  await run(
    'INSERT INTO audit_logs (record_id, action, old_value, new_value, operator, role) VALUES (?, ?, ?, ?, ?, ?)',
    [recordId, action, oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null, operator, role]
  );
}

async function getAuditLogs(recordId = null) {
  let query = 'SELECT * FROM audit_logs WHERE 1=1';
  const params = [];

  if (recordId) {
    query += ' AND record_id = ?';
    params.push(recordId);
  }
  query += ' ORDER BY created_at DESC';

  return all(query, params);
}

async function updateBookRecord(bookId, updates, operator = config.defaultOperator, role = config.defaultRole) {
  const oldRecord = await get('SELECT * FROM book_records WHERE id = ?', [bookId]);

  const allowedFields = ['isbn', 'title', 'author', 'publisher', 'grade', 'condition', 'donor', 'remark', 'status'];
  const setClauses = [];
  const values = [];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      setClauses.push(`${field} = ?`);
      values.push(updates[field]);
    }
  }

  if (setClauses.length > 0) {
    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    values.push(bookId);

    await run(
      `UPDATE book_records SET ${setClauses.join(', ')} WHERE id = ?`,
      values
    );

    await logAudit(bookId, 'update', oldRecord, updates, operator, role);
  }
}

module.exports = {
  createSession,
  updateSessionStats,
  getSession,
  getAllSessions,
  insertBookRecord,
  insertErrorRecord,
  getBookRecords,
  getErrorRecords,
  updateBookStatus,
  resolveError,
  getAuditLogs,
  updateBookRecord
};
