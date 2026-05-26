const { run, all, get } = require('../db/connection');
const auditService = require('./auditService');

async function createArtifact(data, operator) {
  const { artifactNo, name, level, era, valuation, description } = data;
  const result = await run(
    'INSERT INTO artifacts (artifact_no, name, level, era, valuation, description) VALUES (?, ?, ?, ?, ?, ?)',
    [artifactNo, name, level, era || '', valuation, description || '']
  );
  await auditService.logAudit('新增文物', `新增文物: ${artifactNo}`, operator, null, result.lastId);
  return result.lastId;
}

async function updateArtifact(id, data, operator) {
  const fields = [];
  const params = [];
  const changedFields = [];

  if (data.name !== undefined) { fields.push('name = ?'); params.push(data.name); changedFields.push(`名称→${data.name}`); }
  if (data.level !== undefined) { fields.push('level = ?'); params.push(data.level); changedFields.push(`等级→${data.level}`); }
  if (data.era !== undefined) { fields.push('era = ?'); params.push(data.era); }
  if (data.description !== undefined) { fields.push('description = ?'); params.push(data.description); }

  if (data.valuation !== undefined) {
    const old = await get('SELECT valuation FROM artifacts WHERE id = ?', [id]);
    if (old && parseFloat(old.valuation) !== parseFloat(data.valuation)) {
      await run(
        'INSERT INTO valuation_changes (artifact_id, old_value, new_value, reason, operator) VALUES (?, ?, ?, ?, ?)',
        [id, old.valuation, data.valuation, '文物估值更新', operator]
      );
      changedFields.push(`估值 ${old.valuation}→${data.valuation}`);
    }
    fields.push('valuation = ?');
    params.push(data.valuation);
  }

  fields.push('updated_at = datetime(\'now\', \'localtime\')');
  params.push(id);

  await run(`UPDATE artifacts SET ${fields.join(', ')} WHERE id = ?`, params);
  await auditService.logAudit('更新文物', changedFields.join('; '), operator, null, id);
}

async function updateValuation(id, newValue, reason, operator) {
  const old = await get('SELECT valuation FROM artifacts WHERE id = ?', [id]);
  if (!old) throw new Error('文物不存在');

  await run(
    'INSERT INTO valuation_changes (artifact_id, old_value, new_value, reason, operator) VALUES (?, ?, ?, ?, ?)',
    [id, old.valuation, newValue, reason, operator]
  );

  await run('UPDATE artifacts SET valuation = ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?', [newValue, id]);
  await auditService.logAudit('估值变更', `${old.valuation}→${newValue}, 原因: ${reason}`, operator, null, id);
}

async function getArtifacts(filters, pagination) {
  const conditions = [];
  const params = [];

  if (filters.artifactNo) {
    conditions.push('artifact_no LIKE ?');
    params.push('%' + filters.artifactNo + '%');
  }
  if (filters.name) {
    conditions.push('name LIKE ?');
    params.push('%' + filters.name + '%');
  }
  if (filters.level) {
    conditions.push('level = ?');
    params.push(filters.level);
  }
  if (filters.minValuation !== undefined) {
    conditions.push('valuation >= ?');
    params.push(filters.minValuation);
  }
  if (filters.maxValuation !== undefined) {
    conditions.push('valuation <= ?');
    params.push(filters.maxValuation);
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const countSql = `SELECT COUNT(*) as total FROM artifacts ${where}`;
  const dataSql = `SELECT * FROM artifacts ${where} ORDER BY level, artifact_no LIMIT ? OFFSET ?`;

  const countResult = await get(countSql, params);
  const data = await all(dataSql, [...params, pagination.limit, pagination.offset]);

  return { total: countResult.total, data, page: pagination.page, limit: pagination.limit };
}

async function getArtifactDetail(id) {
  const artifact = await get('SELECT * FROM artifacts WHERE id = ?', [id]);
  if (!artifact) throw new Error('文物不存在');

  const valuationHistory = await all(
    'SELECT * FROM valuation_changes WHERE artifact_id = ? ORDER BY created_at DESC',
    [id]
  );
  const batchRecords = await all(`
    SELECT ba.*, b.batch_no, b.status as batch_status
    FROM batch_artifacts ba
    JOIN batches b ON ba.batch_id = b.id
    WHERE ba.artifact_id = ?
    ORDER BY b.created_at DESC
  `, [id]);
  const transportRecords = await all(`
    SELECT tb.*, t.transport_no, t.carrier, t.status as transport_status, t.departure_time, t.arrival_time
    FROM transport_boxes tb
    JOIN transports t ON tb.transport_id = t.id
    WHERE tb.artifact_id = ?
    ORDER BY t.created_at DESC
  `, [id]);
  const insuranceRecords = await all(`
    SELECT ip.* FROM insurance_policies ip
    WHERE ip.batch_id IN (SELECT batch_id FROM batch_artifacts WHERE artifact_id = ?)
    ORDER BY ip.created_at DESC
  `, [id]);
  const exceptions = await all(
    'SELECT * FROM exceptions WHERE artifact_id = ? ORDER BY created_at DESC',
    [id]
  );
  const auditLogs = await all(
    'SELECT * FROM audit_logs WHERE artifact_id = ? OR batch_id IN (SELECT batch_id FROM batch_artifacts WHERE artifact_id = ?) ORDER BY created_at DESC',
    [id, id]
  );

  return {
    ...artifact,
    valuation_history: valuationHistory,
    batch_records: batchRecords,
    transport_records: transportRecords,
    insurance_records: insuranceRecords,
    exceptions,
    audit_logs: auditLogs
  };
}

async function getValuationChanges(artifactId) {
  return all(
    'SELECT * FROM valuation_changes WHERE artifact_id = ? ORDER BY created_at DESC',
    [artifactId]
  );
}

module.exports = { createArtifact, updateArtifact, updateValuation, getArtifacts, getArtifactDetail, getValuationChanges };
