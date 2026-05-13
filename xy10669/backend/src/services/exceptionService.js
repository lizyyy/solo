const { runQuery, runInsert, runUpdate } = require('../database');

async function createException(type, appointmentId, itemId, description, severity = 'warning') {
  return await runInsert(
    `INSERT INTO exceptions (type, appointment_id, item_id, description, severity)
     VALUES (?, ?, ?, ?, ?)`,
    [type, appointmentId, itemId, description, severity]
  );
}

async function checkItemExclusions(appointmentId, currentItems, newItemId) {
  const exclusions = await runQuery(
    `SELECT * FROM item_exclusions 
     WHERE (item1_id = ? OR item2_id = ?)
     AND (item1_id IN (?) OR item2_id IN (?))`,
    [newItemId, newItemId, currentItems.join(','), currentItems.join(',')]
  );

  if (exclusions.length > 0) {
    for (const exclusion of exclusions) {
      await createException(
        'item_exclusion',
        appointmentId,
        newItemId,
        `项目互斥冲突: 新项目与现有项目存在互斥关系`,
        'error'
      );
    }
    return false;
  }
  return true;
}

async function getExceptions(filters = {}) {
  let sql = `SELECT e.*, a.user_name, a.appointment_date, i.name as item_name
             FROM exceptions e
             LEFT JOIN appointments a ON e.appointment_id = a.id
             LEFT JOIN items i ON e.item_id = i.id
             WHERE 1=1`;
  const params = [];

  if (filters.status) {
    sql += ` AND e.status = ?`;
    params.push(filters.status);
  }
  if (filters.severity) {
    sql += ` AND e.severity = ?`;
    params.push(filters.severity);
  }
  if (filters.type) {
    sql += ` AND e.type = ?`;
    params.push(filters.type);
  }

  sql += ` ORDER BY e.created_at DESC`;
  return await runQuery(sql, params);
}

async function resolveException(exceptionId, handledBy, resolution) {
  return await runUpdate(
    `UPDATE exceptions 
     SET status = 'resolved', handled_by = ?, handled_at = CURRENT_TIMESTAMP, resolution = ?
     WHERE id = ?`,
    [handledBy, resolution, exceptionId]
  );
}

async function getExceptionStats() {
  return await runQuery(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_count,
      SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved_count,
      SUM(CASE WHEN severity = 'error' THEN 1 ELSE 0 END) as error_count,
      SUM(CASE WHEN severity = 'warning' THEN 1 ELSE 0 END) as warning_count
    FROM exceptions
  `);
}

module.exports = {
  createException,
  checkItemExclusions,
  getExceptions,
  resolveException,
  getExceptionStats
};
