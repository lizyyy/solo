const { db, updateTimestamps } = require('./db');
const dataParser = require('./dataParser');

function logOperation(opts) {
  db.prepare(`
    INSERT INTO operation_logs (batch_id, card_record_id, refund_record_id, action, operator, reason, detail)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    opts.batch_id || null,
    opts.card_record_id || null,
    opts.refund_record_id || null,
    opts.action,
    opts.operator,
    opts.reason || null,
    opts.detail || null
  );
}

function getBatchById(id) {
  return db.prepare('SELECT * FROM batches WHERE id = ?').get(id);
}

module.exports = {
  getBatchById,
  logOperation
};
