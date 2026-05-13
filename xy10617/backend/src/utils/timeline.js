const { v4: uuidv4 } = require('uuid');
const db = require('./db');

const addTimelineEntry = async (bookId, status, previousStatus, changedBy, changeReason, oldValues = null, newValues = null) => {
  const id = uuidv4();
  
  await db.run(
    `INSERT INTO status_timeline (id, book_id, status, previous_status, changed_by, change_reason, old_values, new_values)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      bookId,
      status,
      previousStatus,
      changedBy,
      changeReason,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null
    ]
  );

  return id;
};

const getTimelineByBookId = async (bookId) => {
  const entries = await db.all(
    `SELECT * FROM status_timeline WHERE book_id = ? ORDER BY created_at DESC`,
    [bookId]
  );

  return entries.map(entry => ({
    ...entry,
    old_values: entry.old_values ? JSON.parse(entry.old_values) : null,
    new_values: entry.new_values ? JSON.parse(entry.new_values) : null
  }));
};

module.exports = { addTimelineEntry, getTimelineByBookId };
