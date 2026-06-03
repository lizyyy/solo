const db = require('./db');

function createNote(note, callback) {
  const sql = `
    INSERT INTO reconciliation_notes (
      record_id, note_content, operator, update_time
    ) VALUES (?, ?, ?, ?)
  `;
  const params = [
    note.record_id,
    note.note_content,
    note.operator,
    note.update_time
  ];
  db.run(sql, params, function(err) {
    callback(err, err ? null : this.lastID);
  });
}

function getNotesByRecordId(recordId, callback) {
  const sql = `SELECT * FROM reconciliation_notes WHERE record_id = ? ORDER BY update_time DESC`;
  db.all(sql, [recordId], callback);
}

function getAllNotes(callback) {
  const sql = `SELECT * FROM reconciliation_notes ORDER BY update_time DESC`;
  db.all(sql, [], callback);
}

module.exports = {
  createNote,
  getNotesByRecordId,
  getAllNotes
};
