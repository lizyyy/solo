const { run, all, get } = require('../db/connection');

async function logAudit(action, detail, operator, batchId = null, artifactId = null) {
  return run(
    'INSERT INTO audit_logs (batch_id, artifact_id, action, detail, operator) VALUES (?, ?, ?, ?, ?)',
    [batchId, artifactId, action, detail || null, operator]
  );
}

async function queryAudit(filters, pagination) {
  const conditions = [];
  const params = [];

  if (filters.batchId) {
    conditions.push('batch_id = ?');
    params.push(filters.batchId);
  }
  if (filters.artifactId) {
    conditions.push('artifact_id = ?');
    params.push(filters.artifactId);
  }
  if (filters.action) {
    conditions.push('action = ?');
    params.push(filters.action);
  }
  if (filters.operator) {
    conditions.push('operator LIKE ?');
    params.push('%' + filters.operator + '%');
  }
  if (filters.startDate) {
    conditions.push('created_at >= ?');
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    conditions.push('created_at <= ?');
    params.push(filters.endDate + ' 23:59:59');
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const countSql = `SELECT COUNT(*) as total FROM audit_logs ${where}`;
  const dataSql = `SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`;

  const countResult = await get(countSql, params);
  const data = await all(dataSql, [...params, pagination.limit, pagination.offset]);

  return { total: countResult.total, data };
}

async function getArtifactHistory(artifactId) {
  return all(`
    SELECT * FROM audit_logs
    WHERE artifact_id = ? OR batch_id IN (
      SELECT batch_id FROM batch_artifacts WHERE artifact_id = ?
    )
    ORDER BY created_at DESC
  `, [artifactId, artifactId]);
}

async function getBatchHistory(batchId) {
  return all(`
    SELECT * FROM audit_logs WHERE batch_id = ? ORDER BY created_at DESC
  `, [batchId]);
}

module.exports = { logAudit, queryAudit, getArtifactHistory, getBatchHistory };
