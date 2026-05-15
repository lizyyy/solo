const { v4: uuidv4 } = require('uuid');
const { runQuery, runExecute } = require('./database');

const RULES = {
  BATCH_VALIDATION: 'batch_validation',
  RECONCILIATION: 'reconciliation',
  COMPATIBILITY_ROUTING: 'compatibility_routing',
  TRAFFIC_CONFIRMATION: 'traffic_confirmation',
  ROLLBACK: 'rollback'
};

async function validateMigrationBatch(batchId) {
  const batch = await runQuery('SELECT * FROM traffic_batches WHERE id = ?', [batchId]);
  if (!batch || batch.length === 0) {
    return { valid: false, reason: '批次不存在' };
  }

  const b = batch[0];
  const issues = [];

  if (b.traffic_percentage < 0 || b.traffic_percentage > 100) {
    issues.push('切流比例必须在0-100之间');
  }

  const newEndpoint = await runQuery('SELECT * FROM new_endpoints WHERE id = ?', [b.new_endpoint_id]);
  if (!newEndpoint || newEndpoint.length === 0 || newEndpoint[0].status !== 'ready') {
    issues.push('新端点未就绪');
  }

  const compatibility = await runQuery(
    'SELECT * FROM compatibility_layers WHERE new_endpoint_id = ? AND status = ?',
    [b.new_endpoint_id, 'active']
  );
  if (!compatibility || compatibility.length === 0) {
    issues.push('兼容层未激活');
  }

  return {
    valid: issues.length === 0,
    issues,
    batch: b
  };
}

async function performReconciliation(batchId, oldResponse, newResponse) {
  const crypto = require('crypto');
  const oldHash = crypto.createHash('md5').update(JSON.stringify(oldResponse)).digest('hex');
  const newHash = crypto.createHash('md5').update(JSON.stringify(newResponse)).digest('hex');
  const isMatch = oldHash === newHash;

  let diffDetails = '';
  if (!isMatch) {
    diffDetails = JSON.stringify({
      oldKeys: Object.keys(oldResponse || {}),
      newKeys: Object.keys(newResponse || {})
    });
  }

  const recordId = uuidv4();
  await runExecute(
    'INSERT INTO reconciliation_records (id, batch_id, old_response_hash, new_response_hash, is_match, diff_details) VALUES (?, ?, ?, ?, ?, ?)',
    [recordId, batchId, oldHash, newHash, isMatch ? 1 : 0, diffDetails]
  );

  return {
    id: recordId,
    isMatch,
    diffDetails,
    checkedAt: new Date().toISOString()
  };
}

async function getCompatibilityRoute(callingSystemId, oldEndpointId) {
  const compatibility = await runQuery(`
    SELECT cl.*, ne.url as new_url, ne.method as new_method
    FROM compatibility_layers cl
    JOIN new_endpoints ne ON cl.new_endpoint_id = ne.id
    WHERE cl.old_endpoint_id = ? AND cl.status = 'active'
  `, [oldEndpointId]);

  if (!compatibility || compatibility.length === 0) {
    return { route: 'old_endpoint', reason: '兼容层未配置' };
  }

  const batch = await runQuery(`
    SELECT * FROM traffic_batches
    WHERE calling_system_id = ? AND new_endpoint_id = ? AND status = 'executing'
  `, [callingSystemId, compatibility[0].new_endpoint_id]);

  if (!batch || batch.length === 0) {
    return { route: 'old_endpoint', reason: '无活跃切流批次' };
  }

  const activeBatch = batch[0];
  const random = Math.random() * 100;

  if (random < activeBatch.traffic_percentage) {
    return {
      route: 'new_endpoint',
      batchId: activeBatch.id,
      newUrl: compatibility[0].new_url,
      transformationRules: compatibility[0].transformation_rules
    };
  }

  return { route: 'old_endpoint', reason: '切流比例内未命中' };
}

async function confirmTrafficSwitch(batchId, operator) {
  const validation = await validateMigrationBatch(batchId);
  if (!validation.valid) {
    return { success: false, errors: validation.issues };
  }

  const reconciliation = await runQuery(
    'SELECT * FROM reconciliation_records WHERE batch_id = ? ORDER BY checked_at DESC LIMIT 5',
    [batchId]
  );

  const matchRate = reconciliation.length > 0
    ? reconciliation.filter(r => r.is_match).length / reconciliation.length
    : 0;

  if (matchRate < 0.95) {
    return { success: false, errors: [`对账成功率不足95%，当前: ${(matchRate * 100).toFixed(1)}%`] };
  }

  await runExecute(
    'UPDATE traffic_batches SET status = ?, executed_at = CURRENT_TIMESTAMP WHERE id = ?',
    ['confirmed', batchId]
  );

  await logRequest(batchId, null, null, 'traffic_confirmed', null, operator);

  return { success: true, matchRate, confirmedAt: new Date().toISOString() };
}

async function executeRollback(batchId, reason, operator) {
  const batch = await runQuery('SELECT * FROM traffic_batches WHERE id = ?', [batchId]);
  if (!batch || batch.length === 0) {
    return { success: false, error: '批次不存在' };
  }

  const rollbackId = uuidv4();
  await runExecute(
    'INSERT INTO rollback_records (id, batch_id, reason, rolled_back_by) VALUES (?, ?, ?, ?)',
    [rollbackId, batchId, reason, operator]
  );

  await runExecute(
    'UPDATE traffic_batches SET status = ? WHERE id = ?',
    ['rolled_back', batchId]
  );

  await logRequest(batchId, null, null, 'rolled_back', reason, operator);

  return {
    success: true,
    rollbackId,
    rolledBackAt: new Date().toISOString()
  };
}

async function logRequest(batchId, oldEndpointId, newEndpointId, status, errorMessage, responsibleNode) {
  const logId = uuidv4();
  const batch = await runQuery('SELECT * FROM traffic_batches WHERE id = ?', [batchId]);
  const callingSystemId = batch && batch.length > 0 ? batch[0].calling_system_id : null;

  await runExecute(
    `INSERT INTO request_logs 
     (id, batch_id, old_endpoint_id, new_endpoint_id, calling_system_id, request_input, response_output, status, error_message, responsible_node) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [logId, batchId, oldEndpointId, newEndpointId, callingSystemId, '{}', '{}', status, errorMessage, responsibleNode]
  );

  return logId;
}

async function getExceptionQueue() {
  return await runQuery(`
    SELECT rl.*, tb.name as batch_name, cs.name as system_name
    FROM request_logs rl
    LEFT JOIN traffic_batches tb ON rl.batch_id = tb.id
    LEFT JOIN calling_systems cs ON rl.calling_system_id = cs.id
    WHERE rl.status IN ('failed', 'error', 'timeout')
    ORDER BY rl.timestamp DESC
    LIMIT 100
  `);
}

async function getMigrationStats() {
  const totalEndpoints = await runQuery('SELECT COUNT(*) as count FROM old_endpoints');
  const migratedEndpoints = await runQuery('SELECT COUNT(*) as count FROM new_endpoints WHERE status = "ready"');
  const activeBatches = await runQuery('SELECT COUNT(*) as count FROM traffic_batches WHERE status = "executing"');
  const exceptions = await runQuery('SELECT COUNT(*) as count FROM request_logs WHERE status IN ("failed", "error")');

  return {
    totalEndpoints: totalEndpoints[0].count,
    migratedEndpoints: migratedEndpoints[0].count,
    activeBatches: activeBatches[0].count,
    exceptions: exceptions[0].count,
    migrationProgress: totalEndpoints[0].count > 0
      ? Math.round((migratedEndpoints[0].count / totalEndpoints[0].count) * 100)
      : 0
  };
}

module.exports = {
  RULES,
  validateMigrationBatch,
  performReconciliation,
  getCompatibilityRoute,
  confirmTrafficSwitch,
  executeRollback,
  logRequest,
  getExceptionQueue,
  getMigrationStats
};
