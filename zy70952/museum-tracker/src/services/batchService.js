const { run, all, get } = require('../db/connection');
const auditService = require('./auditService');

async function createBatch(data, operator) {
  const { batchNo, artifactIds, handler } = data;

  const existing = await get('SELECT id FROM batches WHERE batch_no = ?', [batchNo]);
  if (existing) throw new Error(`批次号已存在: ${batchNo}`);

  const result = await run(
    'INSERT INTO batches (batch_no, handler) VALUES (?, ?)',
    [batchNo, handler || '']
  );

  if (artifactIds && Array.isArray(artifactIds) && artifactIds.length > 0) {
    for (const aid of artifactIds) {
      const artifact = await get('SELECT valuation FROM artifacts WHERE id = ?', [aid]);
      if (artifact) {
        await run(
          'INSERT INTO batch_artifacts (batch_id, artifact_id, valuation_snapshot) VALUES (?, ?, ?)',
          [result.lastId, aid, artifact.valuation]
        );
      }
    }
  }

  await auditService.logAudit('新增批次', `新增批次: ${batchNo}, 文物数量: ${artifactIds ? artifactIds.length : 0}`, operator, result.lastId);
  return result.lastId;
}

async function getBatches(filters, pagination) {
  const conditions = [];
  const params = [];

  if (filters.batchNo) {
    conditions.push('batch_no LIKE ?');
    params.push('%' + filters.batchNo + '%');
  }
  if (filters.status) {
    conditions.push('status = ?');
    params.push(filters.status);
  }
  if (filters.handler) {
    conditions.push('handler LIKE ?');
    params.push('%' + filters.handler + '%');
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
  const countSql = `SELECT COUNT(*) as total FROM batches ${where}`;
  const dataSql = `SELECT * FROM batches ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`;

  const countResult = await get(countSql, params);
  const data = await all(dataSql, [...params, pagination.limit, pagination.offset]);

  return { total: countResult.total, data, page: pagination.page, limit: pagination.limit };
}

async function getBatchDetail(batchId) {
  const batch = await get('SELECT * FROM batches WHERE id = ?', [batchId]);
  if (!batch) throw new Error('批次不存在');

  const artifacts = await all(`
    SELECT ba.*, a.artifact_no, a.name, a.level, a.era, a.valuation as current_valuation
    FROM batch_artifacts ba
    JOIN artifacts a ON ba.artifact_id = a.id
    WHERE ba.batch_id = ?
    ORDER BY a.level, a.artifact_no
  `, [batchId]);

  const transports = await all(
    'SELECT * FROM transports WHERE batch_id = ? ORDER BY created_at DESC',
    [batchId]
  );

  const insurance = await all(
    'SELECT * FROM insurance_policies WHERE batch_id = ? ORDER BY created_at DESC',
    [batchId]
  );

  const exceptions = await all(`
    SELECT e.*, a.artifact_no, a.name as artifact_name
    FROM exceptions e
    LEFT JOIN artifacts a ON e.artifact_id = a.id
    WHERE e.batch_id = ?
    ORDER BY e.created_at DESC
  `, [batchId]);

  const auditLogs = await all(
    'SELECT * FROM audit_logs WHERE batch_id = ? ORDER BY created_at DESC',
    [batchId]
  );

  return { ...batch, artifacts, transports, insurance, exceptions, audit_logs: auditLogs };
}

async function addArtifactsToBatch(batchId, artifactIds, operator) {
  let added = 0;
  for (const aid of artifactIds) {
    const existing = await get('SELECT id FROM batch_artifacts WHERE batch_id = ? AND artifact_id = ?', [batchId, aid]);
    if (existing) continue;
    const artifact = await get('SELECT valuation FROM artifacts WHERE id = ?', [aid]);
    if (!artifact) continue;
    await run(
      'INSERT INTO batch_artifacts (batch_id, artifact_id, valuation_snapshot) VALUES (?, ?, ?)',
      [batchId, aid, artifact.valuation]
    );
    added++;
  }
  await auditService.logAudit('批次添加文物', `添加 ${added} 件文物到批次`, operator, batchId);
  return added;
}

async function removeArtifactFromBatch(batchId, artifactId, operator) {
  await run('DELETE FROM batch_artifacts WHERE batch_id = ? AND artifact_id = ?', [batchId, artifactId]);
  await auditService.logAudit('批次移除文物', `移除文物 ID: ${artifactId}`, operator, batchId);
}

async function approveBatch(batchId, operator, comment) {
  const batch = await get('SELECT * FROM batches WHERE id = ?', [batchId]);
  if (!batch) throw new Error('批次不存在');
  if (batch.status === '已放行') throw new Error('批次已放行');

  await run(
    'UPDATE batches SET status = ?, reviewer = ?, review_comment = ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?',
    ['已放行', operator, comment || '', batchId]
  );

  await run(
    'UPDATE batch_artifacts SET processing_status = ?, returned_reason = NULL WHERE batch_id = ?',
    ['已放行', batchId]
  );

  await auditService.logAudit('放行批次', comment ? `评审意见: ${comment}` : '', operator, batchId);
}

async function returnBatch(batchId, operator, reason) {
  const batch = await get('SELECT * FROM batches WHERE id = ?', [batchId]);
  if (!batch) throw new Error('批次不存在');

  await run(
    'UPDATE batches SET status = ?, reviewer = ?, review_comment = ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?',
    ['已退回', operator, reason || '', batchId]
  );

  await run(
    'UPDATE batch_artifacts SET processing_status = ?, returned_reason = ? WHERE batch_id = ?',
    ['已退回', reason || '', batchId]
  );

  await auditService.logAudit('退回批次', `退回原因: ${reason || ''}`, operator, batchId);
}

async function requestMoreMaterials(batchId, operator, materialsNeeded, artifactIds) {
  const batch = await get('SELECT * FROM batches WHERE id = ?', [batchId]);
  if (!batch) throw new Error('批次不存在');

  await run(
    'UPDATE batches SET status = ?, reviewer = ?, review_comment = ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?',
    ['需补材料', operator, `需补材料: ${materialsNeeded}`, batchId]
  );

  if (artifactIds && artifactIds.length > 0) {
    for (const aid of artifactIds) {
      await run(
        'UPDATE batch_artifacts SET processing_status = ?, returned_reason = ? WHERE batch_id = ? AND artifact_id = ?',
        ['需补材料', `需补材料: ${materialsNeeded}`, batchId, aid]
      );
    }
  } else {
    await run(
      'UPDATE batch_artifacts SET processing_status = ?, returned_reason = ? WHERE batch_id = ?',
      ['需补材料', `需补材料: ${materialsNeeded}`, batchId]
    );
  }

  await auditService.logAudit('要求补材料', `需补材料: ${materialsNeeded}`, operator, batchId);
}

async function processArtifactInBatch(batchId, artifactId, action, operator, reason) {
  const validActions = ['已放行', '已退回', '需补材料'];
  if (!validActions.includes(action)) {
    throw new Error(`无效的处理动作，必须是: ${validActions.join(', ')}`);
  }

  const ba = await get('SELECT * FROM batch_artifacts WHERE batch_id = ? AND artifact_id = ?', [batchId, artifactId]);
  if (!ba) throw new Error('文物不在该批次中');

  await run(
    'UPDATE batch_artifacts SET processing_status = ?, returned_reason = ? WHERE batch_id = ? AND artifact_id = ?',
    [action, reason || '', batchId, artifactId]
  );

  const artifact = await get('SELECT artifact_no, name FROM artifacts WHERE id = ?', [artifactId]);
  const actionText = action === '已放行' ? '放行' : action === '已退回' ? '退回' : '需补材料';
  await auditService.logAudit(
    `${actionText}文物`,
    `${artifact ? artifact.artifact_no + ' ' + artifact.name : '文物ID:' + artifactId}, ${reason || ''}`,
    operator,
    batchId,
    artifactId
  );

  const allDone = await get(`
    SELECT COUNT(*) as cnt FROM batch_artifacts
    WHERE batch_id = ? AND processing_status NOT IN ('已放行', '已退回', '需补材料')
  `, [batchId]);

  if (allDone.cnt === 0) {
    const approvedCount = await get(`
      SELECT COUNT(*) as cnt FROM batch_artifacts WHERE batch_id = ? AND processing_status = '已放行'
    `, [batchId]);
    const totalCount = await get(`
      SELECT COUNT(*) as cnt FROM batch_artifacts WHERE batch_id = ?
    `, [batchId]);

    let newStatus = '已退回';
    if (approvedCount.cnt === totalCount.cnt) {
      newStatus = '已放行';
    } else if (approvedCount.cnt > 0) {
      newStatus = '待审核';
    }

    await run(
      'UPDATE batches SET status = ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?',
      [newStatus, batchId]
    );
  }
}

module.exports = {
  createBatch, getBatches, getBatchDetail,
  addArtifactsToBatch, removeArtifactFromBatch,
  approveBatch, returnBatch, requestMoreMaterials,
  processArtifactInBatch
};
