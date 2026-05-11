const { run, all } = require('../config/database');

async function recordStatusChange(entityType, entityId, fromStatus, toStatus, operator = null, reason = null) {
  await run(
    `INSERT INTO status_history (entity_type, entity_id, from_status, to_status, operator, reason)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [entityType, entityId, fromStatus, toStatus, operator, reason]
  );
}

async function getStatusHistory(entityType, entityId) {
  return all(
    `SELECT * FROM status_history
     WHERE entity_type = ? AND entity_id = ?
     ORDER BY created_at ASC`,
    [entityType, entityId]
  );
}

async function getLatestStatus(entityType, entityId) {
  const rows = await all(
    `SELECT to_status FROM status_history
     WHERE entity_type = ? AND entity_id = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [entityType, entityId]
  );
  return rows.length > 0 ? rows[0].to_status : null;
}

module.exports = {
  recordStatusChange,
  getStatusHistory,
  getLatestStatus
};
