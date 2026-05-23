const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../config/database');

function recordOperation(factId, queueId, dirtyRecordId, operationType, operator, oldValue, newValue, notes = '') {
  const db = getDatabase();
  const operationId = `op_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
  
  const stmt = db.prepare(`
    INSERT INTO operation_history (
      operation_id, fact_id, queue_id, dirty_record_id,
      operation_type, operator, old_value, new_value,
      operation_notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    operationId,
    factId,
    queueId,
    dirtyRecordId,
    operationType,
    operator,
    oldValue ? JSON.stringify(oldValue) : null,
    newValue ? JSON.stringify(newValue) : null,
    notes,
    new Date().toISOString()
  );
  
  return operationId;
}

function getFactHistory(factId, limit = 50) {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    SELECT * FROM operation_history
    WHERE fact_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);
  
  return stmt.all(factId, limit).map(item => ({
    ...item,
    old_value: item.old_value ? JSON.parse(item.old_value) : null,
    new_value: item.new_value ? JSON.parse(item.new_value) : null
  }));
}

function getDirtyRecordHistory(dirtyRecordId, limit = 50) {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    SELECT * FROM operation_history
    WHERE dirty_record_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);
  
  return stmt.all(dirtyRecordId, limit).map(item => ({
    ...item,
    old_value: item.old_value ? JSON.parse(item.old_value) : null,
    new_value: item.new_value ? JSON.parse(item.new_value) : null
  }));
}

function addManualNote(factId, author, noteType, content, attachments = null) {
  const db = getDatabase();
  const noteId = `note_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
  const now = new Date().toISOString();
  
  const stmt = db.prepare(`
    INSERT INTO manual_notes (
      note_id, fact_id, author, note_type, content,
      attachments, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    noteId,
    factId,
    author,
    noteType,
    content,
    attachments ? JSON.stringify(attachments) : null,
    now,
    now
  );
  
  recordOperation(
    factId,
    null,
    null,
    'note_add',
    author,
    null,
    { noteType, content },
    '添加人工备注'
  );
  
  return noteId;
}

function getFactNotes(factId) {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    SELECT * FROM manual_notes
    WHERE fact_id = ?
    ORDER BY created_at DESC
  `);
  
  return stmt.all(factId).map(item => ({
    ...item,
    attachments: item.attachments ? JSON.parse(item.attachments) : null
  }));
}

module.exports = {
  recordOperation,
  getFactHistory,
  getDirtyRecordHistory,
  addManualNote,
  getFactNotes
};
