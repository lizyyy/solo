const db = require('../db');

const insertAudit = db.prepare(`
  INSERT INTO audit_logs (
    task_id, action, operator, operator_role, old_status, new_status,
    details, error_type, error_message, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

function recordAudit(taskId, action, operator, operatorRole, oldStatus, newStatus, details, errorType = null, errorMessage = null) {
  const now = Date.now();
  insertAudit.run(
    taskId,
    action,
    operator,
    operatorRole,
    oldStatus,
    newStatus,
    details,
    errorType,
    errorMessage,
    now
  );
}

module.exports = { recordAudit };
