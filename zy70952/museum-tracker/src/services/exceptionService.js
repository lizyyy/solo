const { run, all, get } = require('../db/connection');
const auditService = require('./auditService');

async function createException(data, operator) {
  const { batchId, artifactId, type, description } = data;

  if (!batchId) throw new Error('批次ID必填');
  if (!type) throw new Error('异常类型必填');
  if (!description) throw new Error('异常描述必填');

  const result = await run(
    'INSERT INTO exceptions (batch_id, artifact_id, type, description, handler) VALUES (?, ?, ?, ?, ?)',
    [batchId, artifactId || null, type, description, operator]
  );

  const batch = await get('SELECT batch_no FROM batches WHERE id = ?', [batchId]);
  const detail = `类型: ${type}; 描述: ${description}; 批次: ${batch ? batch.batch_no : ''}`;
  await auditService.logAudit('记录异常', detail, operator, batchId, artifactId || null);

  return result.lastId;
}

async function getExceptions(filters, pagination) {
  const conditions = [];
  const params = [];

  if (filters.batchId) {
    conditions.push('e.batch_id = ?');
    params.push(filters.batchId);
  }
  if (filters.type) {
    conditions.push('e.type = ?');
    params.push(filters.type);
  }
  if (filters.resolved !== undefined) {
    conditions.push('e.resolved = ?');
    params.push(filters.resolved ? 1 : 0);
  }
  if (filters.handler) {
    conditions.push('e.handler LIKE ?');
    params.push('%' + filters.handler + '%');
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const countSql = `SELECT COUNT(*) as total FROM exceptions e ${where}`;
  const dataSql = `
    SELECT e.*, a.artifact_no, a.name as artifact_name, b.batch_no
    FROM exceptions e
    LEFT JOIN artifacts a ON e.artifact_id = a.id
    LEFT JOIN batches b ON e.batch_id = b.id
    ${where}
    ORDER BY e.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const countResult = await get(countSql, params);
  const data = await all(dataSql, [...params, pagination.limit, pagination.offset]);

  return { total: countResult.total, data, page: pagination.page, limit: pagination.limit };
}

async function resolveException(id, operator, resolutionNote) {
  const exc = await get('SELECT * FROM exceptions WHERE id = ?', [id]);
  if (!exc) throw new Error('异常记录不存在');
  if (exc.resolved) throw new Error('异常已处理');

  await run(
    'UPDATE exceptions SET resolved = 1, resolved_by = ?, resolved_at = datetime(\'now\', \'localtime\'), resolution_note = ? WHERE id = ?',
    [operator, resolutionNote || '', id]
  );

  await auditService.logAudit(
    '处理异常',
    `异常类型: ${exc.type}; 处理说明: ${resolutionNote || ''}`,
    operator,
    exc.batch_id,
    exc.artifact_id
  );
}

async function getExceptionDetail(id) {
  return get(`
    SELECT e.*, a.artifact_no, a.name as artifact_name, b.batch_no
    FROM exceptions e
    LEFT JOIN artifacts a ON e.artifact_id = a.id
    LEFT JOIN batches b ON e.batch_id = b.id
    WHERE e.id = ?
  `, [id]);
}

async function searchByArtifactLevel(level, pagination) {
  const data = await all(`
    SELECT DISTINCT b.*, COUNT(ba.artifact_id) as artifact_count
    FROM batches b
    JOIN batch_artifacts ba ON b.id = ba.batch_id
    JOIN artifacts a ON ba.artifact_id = a.id
    WHERE a.level = ?
    ORDER BY b.created_at DESC
    LIMIT ? OFFSET ?
  `, [level, pagination.limit, pagination.offset]);

  const countResult = await get(`
    SELECT COUNT(DISTINCT b.id) as total
    FROM batches b
    JOIN batch_artifacts ba ON b.id = ba.batch_id
    JOIN artifacts a ON ba.artifact_id = a.id
    WHERE a.level = ?
  `, [level]);

  return { total: countResult.total, data, page: pagination.page, limit: pagination.limit };
}

async function searchByInsurancePolicy(policyNo, pagination) {
  const data = await all(`
    SELECT b.*, ip.policy_no, ip.insurer, ip.insured_value
    FROM batches b
    JOIN insurance_policies ip ON b.id = ip.batch_id
    WHERE ip.policy_no LIKE ?
    ORDER BY b.created_at DESC
    LIMIT ? OFFSET ?
  `, ['%' + policyNo + '%', pagination.limit, pagination.offset]);

  const countResult = await get(`
    SELECT COUNT(*) as total
    FROM batches b
    JOIN insurance_policies ip ON b.id = ip.batch_id
    WHERE ip.policy_no LIKE ?
  `, ['%' + policyNo + '%']);

  return { total: countResult.total, data, page: pagination.page, limit: pagination.limit };
}

async function searchByTransportBox(boxNo, pagination) {
  const data = await all(`
    SELECT DISTINCT b.*, t.transport_no, tb.box_no, a.artifact_no, a.name as artifact_name
    FROM batches b
    JOIN transports t ON b.id = t.batch_id
    JOIN transport_boxes tb ON t.id = tb.transport_id
    JOIN artifacts a ON tb.artifact_id = a.id
    WHERE tb.box_no LIKE ?
    ORDER BY b.created_at DESC
    LIMIT ? OFFSET ?
  `, ['%' + boxNo + '%', pagination.limit, pagination.offset]);

  const countResult = await get(`
    SELECT COUNT(DISTINCT b.id) as total
    FROM batches b
    JOIN transports t ON b.id = t.batch_id
    JOIN transport_boxes tb ON t.id = tb.transport_id
    WHERE tb.box_no LIKE ?
  `, ['%' + boxNo + '%']);

  return { total: countResult.total, data, page: pagination.page, limit: pagination.limit };
}

module.exports = {
  createException, getExceptions, resolveException, getExceptionDetail,
  searchByArtifactLevel, searchByInsurancePolicy, searchByTransportBox
};
