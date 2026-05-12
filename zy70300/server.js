const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(bodyParser.json());

// 内存数据模型
const configVersions = new Map();
const grayBatches = new Map();
const tenantHits = new Map(); // key: tenantId, value: batchId
const metricsSnapshots = [];
const auditRecords = [];
const rollbackResults = new Map(); // key: tenantId_batchId, value: result
const rollbackSummaries = [];

// 状态常量
const BATCH_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  ROLLED_BACK: 'rolled_back'
};

const TENANT_STATUS = {
  IN_BATCH: 'in_batch',
  ROLLED_BACK: 'rolled_back'
};

const ACTION_TYPES = {
  CONFIG_PUBLISHED: 'config_published',
  BATCH_CREATED: 'batch_created',
  BATCH_PAUSED: 'batch_paused',
  BATCH_ROLLED_BACK: 'batch_rolled_back',
  TENANT_ROLLED_BACK: 'tenant_rolled_back',
  TENANT_DUPLICATE_ROLLBACK: 'tenant_duplicate_rollback',
  METRICS_SNAPSHOT: 'metrics_snapshot',
  CONFIG_QUERIED: 'config_queried'
};

// 辅助函数
function generateId() {
  return uuidv4().slice(0, 8);
}

function currentTime() {
  return new Date().toISOString();
}

function recordAudit(action, operator, details, timestamp) {
  const record = {
    id: generateId(),
    action,
    operator,
    details,
    timestamp: timestamp || currentTime()
  };
  auditRecords.push(record);
  return record;
}

function findLatestConfigVersion(configKey) {
  const versions = [...configVersions.values()].filter(v => v.configKey === configKey);
  if (versions.length === 0) return null;
  return versions.reduce((latest, current) => 
    current.version > latest.version ? current : latest
  );
}

function findBatch(batchId) {
  return grayBatches.get(batchId);
}

function getTenantsInBatch(batchId) {
  return [...tenantHits.entries()]
    .filter(([, bId]) => bId === batchId)
    .map(([tenantId]) => tenantId);
}

function getRolledBackTenantsInBatch(batchId) {
  const batch = grayBatches.get(batchId);
  if (!batch) return [];
  return batch.rolledBackTenants || [];
}

function isTenantRolledBack(tenantId, batchId) {
  const batch = grayBatches.get(batchId);
  if (!batch) return false;
  return (batch.rolledBackTenants || []).includes(tenantId);
}

function markTenantRolledBack(tenantId, batchId) {
  const batch = grayBatches.get(batchId);
  if (!batch) return;
  if (!batch.rolledBackTenants) {
    batch.rolledBackTenants = [];
  }
  if (!batch.rolledBackTenants.includes(tenantId)) {
    batch.rolledBackTenants.push(tenantId);
  }
}

function getRollbackKey(tenantId, batchId) {
  return `${tenantId}_${batchId}`;
}

// ==================== API 接口 ====================

// 1. 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: currentTime() });
});

// 2. 配置版本发布
app.post('/api/configs', (req, res) => {
  const { configKey, configValue, operator = 'system' } = req.body;
  
  if (!configKey || configValue === undefined) {
    return res.status(400).json({ error: 'configKey and configValue are required' });
  }

  const latestVersion = findLatestConfigVersion(configKey);
  const version = latestVersion ? latestVersion.version + 1 : 1;
  const configId = generateId();
  
  const config = {
    id: configId,
    configKey,
    configValue,
    version,
    publishedBy: operator,
    publishedAt: currentTime(),
    status: 'published'
  };
  
  configVersions.set(configId, config);
  recordAudit(ACTION_TYPES.CONFIG_PUBLISHED, operator, {
    configKey,
    version,
    configValue
  });
  
  res.json({
    success: true,
    config
  });
});

// 3. 灰度批次创建
app.post('/api/batches', (req, res) => {
  const { configKey, tenantIds, batchName, operator = 'system' } = req.body;
  
  if (!configKey || !tenantIds || !Array.isArray(tenantIds) || tenantIds.length === 0) {
    return res.status(400).json({ error: 'configKey and non-empty tenantIds array are required' });
  }

  const latestConfig = findLatestConfigVersion(configKey);
  if (!latestConfig) {
    return res.status(404).json({ error: `Config key '${configKey}' not found` });
  }

  const batchId = generateId();
  const batch = {
    id: batchId,
    batchName: batchName || `batch-${batchId}`,
    configKey,
    configVersion: latestConfig.version,
    configId: latestConfig.id,
    tenantCount: tenantIds.length,
    status: BATCH_STATUS.RUNNING,
    createdAt: currentTime(),
    createdBy: operator,
    rolledBackTenants: []
  };
  
  grayBatches.set(batchId, batch);
  
  tenantIds.forEach(tenantId => {
    tenantHits.set(tenantId, batchId);
  });
  
  recordAudit(ACTION_TYPES.BATCH_CREATED, operator, {
    batchId,
    configKey,
    configVersion: latestConfig.version,
    tenantCount: tenantIds.length,
    tenantIds
  });
  
  res.json({
    success: true,
    batch,
    tenantsCount: tenantIds.length
  });
});

// 4. 租户命中查询
app.get('/api/tenants/:tenantId/config/:configKey', (req, res) => {
  const { tenantId, configKey } = req.params;
  const operator = req.query.operator || 'system';
  
  const latestConfig = findLatestConfigVersion(configKey);
  if (!latestConfig) {
    return res.status(404).json({ error: `Config key '${configKey}' not found` });
  }
  
  const batchId = tenantHits.get(tenantId);
  let effectiveConfig = null;
  let hitBatch = null;
  let isRolledBack = false;
  
  if (batchId) {
    const batch = grayBatches.get(batchId);
    if (batch && batch.configKey === configKey) {
      isRolledBack = isTenantRolledBack(tenantId, batchId);
      hitBatch = batch;
      
      if (!isRolledBack && batch.status !== BATCH_STATUS.ROLLED_BACK) {
        effectiveConfig = {
          configKey: batch.configKey,
          configValue: configVersions.get(batch.configId).configValue,
          version: batch.configVersion,
          configId: batch.configId
        };
      }
    }
  }
  
  recordAudit(ACTION_TYPES.CONFIG_QUERIED, operator, {
    tenantId,
    configKey,
    hit: !!effectiveConfig,
    batchId: hitBatch?.id,
    isRolledBack
  });
  
  res.json({
    success: true,
    tenantId,
    configKey,
    hit: !!effectiveConfig,
    isRolledBack,
    batchId: hitBatch?.id,
    batchStatus: hitBatch?.status,
    effectiveConfig,
    queryTime: currentTime()
  });
});

// 5. 指标快照写入
app.post('/api/metrics', (req, res) => {
  const { 
    batchId, 
    tenantId, 
    metrics, 
    snapshotTime, 
    operator = 'system' 
  } = req.body;
  
  if (!batchId || !metrics) {
    return res.status(400).json({ error: 'batchId and metrics are required' });
  }
  
  const batch = grayBatches.get(batchId);
  if (!batch) {
    return res.status(404).json({ error: `Batch '${batchId}' not found` });
  }
  
  const snapshot = {
    id: generateId(),
    batchId,
    tenantId,
    metrics,
    snapshotTime: snapshotTime || currentTime(),
    recordedAt: currentTime(),
    recordedBy: operator
  };
  
  metricsSnapshots.push(snapshot);
  
  recordAudit(ACTION_TYPES.METRICS_SNAPSHOT, operator, {
    snapshotId: snapshot.id,
    batchId,
    tenantId,
    metrics,
    snapshotTime: snapshot.snapshotTime
  });
  
  res.json({
    success: true,
    snapshot
  });
});

// 6. 暂停灰度
app.post('/api/batches/:batchId/pause', (req, res) => {
  const { batchId } = req.params;
  const { reason, operator = 'system' } = req.body;
  
  const batch = grayBatches.get(batchId);
  if (!batch) {
    return res.status(404).json({ error: `Batch '${batchId}' not found` });
  }
  
  if (batch.status === BATCH_STATUS.COMPLETED) {
    return res.status(400).json({ 
      error: 'Cannot pause a completed batch (already fully released)' 
    });
  }
  
  if (batch.status === BATCH_STATUS.PAUSED) {
    return res.json({
      success: true,
      alreadyPaused: true,
      batch
    });
  }
  
  const previousStatus = batch.status;
  batch.status = BATCH_STATUS.PAUSED;
  batch.pausedAt = currentTime();
  batch.pausedBy = operator;
  batch.pauseReason = reason;
  
  recordAudit(ACTION_TYPES.BATCH_PAUSED, operator, {
    batchId,
    previousStatus,
    newStatus: BATCH_STATUS.PAUSED,
    reason,
    affectedTenants: getTenantsInBatch(batchId)
  });
  
  res.json({
    success: true,
    batch
  });
});

// 7. 按租户回滚
app.post('/api/rollbacks/tenant', (req, res) => {
  const { 
    tenantId, 
    batchId, 
    reason, 
    rollbackTime,
    operator = 'system',
    metricsEvidence 
  } = req.body;
  
  if (!tenantId || !batchId) {
    return res.status(400).json({ error: 'tenantId and batchId are required' });
  }
  
  const batch = grayBatches.get(batchId);
  if (!batch) {
    return res.status(404).json({ error: `Batch '${batchId}' not found` });
  }
  
  const hitBatchId = tenantHits.get(tenantId);
  if (!hitBatchId || hitBatchId !== batchId) {
    return res.status(400).json({ 
      error: `Tenant '${tenantId}' is not in batch '${batchId}'` 
    });
  }
  
  // 规则1：已经全量发布后不能按灰度批次回滚
  if (batch.status === BATCH_STATUS.COMPLETED) {
    return res.status(400).json({ 
      error: 'Cannot rollback by batch for completed (fully released) configurations. Please use full rollback.',
      batchStatus: BATCH_STATUS.COMPLETED
    });
  }
  
  // 规则2：同一租户重复回滚
  if (isTenantRolledBack(tenantId, batchId)) {
    const rollbackKey = getRollbackKey(tenantId, batchId);
    const existingResult = rollbackResults.get(rollbackKey);
    
    recordAudit(ACTION_TYPES.TENANT_DUPLICATE_ROLLBACK, operator, {
      tenantId,
      batchId,
      duplicate: true,
      originalRollbackTime: existingResult?.rollbackTime
    });
    
    return res.json({
      success: true,
      duplicate: true,
      existingResult,
      message: 'Tenant already rolled back. Returning existing result.'
    });
  }
  
  // 规则3：指标快照晚于回滚时间
  const actualRollbackTime = rollbackTime || currentTime();
  const latestSnapshot = metricsSnapshots
    .filter(s => s.batchId === batchId && s.tenantId === tenantId)
    .sort((a, b) => new Date(b.snapshotTime) - new Date(a.snapshotTime))[0];
  
  const snapshotAfterRollback = latestSnapshot && 
    new Date(latestSnapshot.snapshotTime) > new Date(actualRollbackTime);
  
  // 执行回滚
  markTenantRolledBack(tenantId, batchId);
  
  const result = {
    id: generateId(),
    tenantId,
    batchId,
    configKey: batch.configKey,
    status: 'success',
    rollbackTime: actualRollbackTime,
    operator,
    reason,
    metricsEvidence,
    snapshotAfterRollback,
    latestSnapshotTime: latestSnapshot?.snapshotTime,
    createdAt: currentTime()
  };
  
  rollbackResults.set(getRollbackKey(tenantId, batchId), result);
  rollbackSummaries.push(result);
  
  recordAudit(ACTION_TYPES.TENANT_ROLLED_BACK, operator, {
    rollbackId: result.id,
    tenantId,
    batchId,
    configKey: batch.configKey,
    reason,
    metricsEvidence,
    rollbackTime: actualRollbackTime,
    snapshotAfterRollback,
    previousConfig: configVersions.get(batch.configId)?.configValue
  });
  
  res.json({
    success: true,
    duplicate: false,
    result,
    warnings: snapshotAfterRollback ? [
      'Warning: Latest metrics snapshot is after rollback time. Manual verification recommended.'
    ] : []
  });
});

// 8. 整批回滚
app.post('/api/rollbacks/batch', (req, res) => {
  const { 
    batchId, 
    reason, 
    rollbackTime,
    operator = 'system',
    metricsEvidence 
  } = req.body;
  
  if (!batchId) {
    return res.status(400).json({ error: 'batchId is required' });
  }
  
  const batch = grayBatches.get(batchId);
  if (!batch) {
    return res.status(404).json({ error: `Batch '${batchId}' not found` });
  }
  
  // 规则：已经全量发布后不能按灰度批次回滚
  if (batch.status === BATCH_STATUS.COMPLETED) {
    return res.status(400).json({ 
      error: 'Cannot rollback by batch for completed (fully released) configurations.',
      batchStatus: BATCH_STATUS.COMPLETED
    });
  }
  
  if (batch.status === BATCH_STATUS.ROLLED_BACK) {
    return res.json({
      success: true,
      alreadyRolledBack: true,
      batch
    });
  }
  
  const previousStatus = batch.status;
  const actualRollbackTime = rollbackTime || currentTime();
  const tenantsInBatch = getTenantsInBatch(batchId);
  
  // 标记批次为已回滚
  batch.status = BATCH_STATUS.ROLLED_BACK;
  batch.rolledBackAt = actualRollbackTime;
  batch.rolledBackBy = operator;
  batch.rollbackReason = reason;
  
  // 批量标记租户
  const rollbackResultsList = [];
  tenantsInBatch.forEach(tenantId => {
    if (!isTenantRolledBack(tenantId, batchId)) {
      markTenantRolledBack(tenantId, batchId);
      
      const result = {
        id: generateId(),
        tenantId,
        batchId,
        configKey: batch.configKey,
        status: 'success',
        rollbackTime: actualRollbackTime,
        operator,
        reason: `Batch rollback: ${reason}`,
        metricsEvidence,
        fromBatchRollback: true,
        createdAt: currentTime()
      };
      
      rollbackResults.set(getRollbackKey(tenantId, batchId), result);
      rollbackSummaries.push(result);
      rollbackResultsList.push(result);
    }
  });
  
  recordAudit(ACTION_TYPES.BATCH_ROLLED_BACK, operator, {
    batchId,
    previousStatus,
    newStatus: BATCH_STATUS.ROLLED_BACK,
    reason,
    rollbackTime: actualRollbackTime,
    tenantsCount: tenantsInBatch.length,
    tenantIds: tenantsInBatch,
    metricsEvidence
  });
  
  res.json({
    success: true,
    batch,
    rollbackCount: rollbackResultsList.length,
    rollbackResults: rollbackResultsList
  });
});

// 9. 查询审计时间线
app.get('/api/audit', (req, res) => {
  const { 
    action, 
    operator, 
    batchId, 
    tenantId,
    startTime,
    endTime,
    limit = 100,
    sort = 'desc'
  } = req.query;
  
  let filtered = [...auditRecords];
  
  if (action) filtered = filtered.filter(r => r.action === action);
  if (operator) filtered = filtered.filter(r => r.operator === operator);
  if (batchId) {
    filtered = filtered.filter(r => 
      r.details?.batchId === batchId || 
      r.details?.snapshotId && metricsSnapshots.find(m => 
        m.id === r.details.snapshotId && m.batchId === batchId
      )
    );
  }
  if (tenantId) {
    filtered = filtered.filter(r => 
      r.details?.tenantId === tenantId ||
      r.details?.tenantIds?.includes(tenantId)
    );
  }
  if (startTime) {
    filtered = filtered.filter(r => new Date(r.timestamp) >= new Date(startTime));
  }
  if (endTime) {
    filtered = filtered.filter(r => new Date(r.timestamp) <= new Date(endTime));
  }
  
  filtered.sort((a, b) => {
    const diff = new Date(a.timestamp) - new Date(b.timestamp);
    return sort === 'asc' ? diff : -diff;
  });
  
  const result = filtered.slice(0, parseInt(limit));
  
  res.json({
    success: true,
    total: filtered.length,
    returned: result.length,
    records: result
  });
});

// 10. 导出回滚原因汇总
app.get('/api/rollbacks/summary', (req, res) => {
  const { 
    batchId, 
    configKey,
    startTime,
    endTime,
    format = 'json'
  } = req.query;
  
  let filtered = [...rollbackSummaries];
  
  if (batchId) filtered = filtered.filter(r => r.batchId === batchId);
  if (configKey) filtered = filtered.filter(r => r.configKey === configKey);
  if (startTime) {
    filtered = filtered.filter(r => new Date(r.rollbackTime) >= new Date(startTime));
  }
  if (endTime) {
    filtered = filtered.filter(r => new Date(r.rollbackTime) <= new Date(endTime));
  }
  
  // 按批次汇总
  const byBatch = {};
  filtered.forEach(item => {
    if (!byBatch[item.batchId]) {
      const batch = grayBatches.get(item.batchId);
      byBatch[item.batchId] = {
        batchId: item.batchId,
        configKey: item.configKey,
        configVersion: batch?.configVersion,
        batchName: batch?.batchName,
        totalTenantsInBatch: batch?.tenantCount || 0,
        rolledBackTenants: [],
        totalRolledBack: 0,
        reasons: [],
        operators: [],
        firstRollbackTime: null,
        lastRollbackTime: null
      };
    }
    
    byBatch[item.batchId].rolledBackTenants.push({
      tenantId: item.tenantId,
      reason: item.reason,
      operator: item.operator,
      rollbackTime: item.rollbackTime,
      metricsEvidence: item.metricsEvidence,
      snapshotAfterRollback: item.snapshotAfterRollback,
      fromBatchRollback: item.fromBatchRollback
    });
    
    byBatch[item.batchId].totalRolledBack++;
    if (item.reason && !byBatch[item.batchId].reasons.includes(item.reason)) {
      byBatch[item.batchId].reasons.push(item.reason);
    }
    if (!byBatch[item.batchId].operators.includes(item.operator)) {
      byBatch[item.batchId].operators.push(item.operator);
    }
    
    const rt = new Date(item.rollbackTime);
    if (!byBatch[item.batchId].firstRollbackTime || 
        rt < new Date(byBatch[item.batchId].firstRollbackTime)) {
      byBatch[item.batchId].firstRollbackTime = item.rollbackTime;
    }
    if (!byBatch[item.batchId].lastRollbackTime || 
        rt > new Date(byBatch[item.batchId].lastRollbackTime)) {
      byBatch[item.batchId].lastRollbackTime = item.rollbackTime;
    }
  });
  
  const summary = {
    generatedAt: currentTime(),
    totalRollbacks: filtered.length,
    affectedBatches: Object.keys(byBatch).length,
    batches: Object.values(byBatch)
  };
  
  if (format === 'markdown') {
    let md = `# 灰度配置回滚原因汇总报告\n\n`;
    md += `生成时间: ${summary.generatedAt}\n\n`;
    md += `## 概览\n\n`;
    md += `- 总回滚次数: ${summary.totalRollbacks}\n`;
    md += `- 受影响批次: ${summary.affectedBatches}\n\n`;
    md += `---\n\n`;
    
    summary.batches.forEach(batch => {
      md += `## 批次: ${batch.batchName || batch.batchId}\n\n`;
      md += `- **批次ID**: ${batch.batchId}\n`;
      md += `- **配置键**: ${batch.configKey}\n`;
      md += `- **配置版本**: ${batch.configVersion}\n`;
      md += `- **批次总租户**: ${batch.totalTenantsInBatch}\n`;
      md += `- **已回滚租户**: ${batch.totalRolledBack}\n`;
      md += `- **首次回滚**: ${batch.firstRollbackTime}\n`;
      md += `- **最后回滚**: ${batch.lastRollbackTime}\n`;
      md += `- **回滚原因**: ${batch.reasons.join(', ')}\n`;
      md += `- **操作人**: ${batch.operators.join(', ')}\n\n`;
      
      md += `### 回滚详情\n\n`;
      md += `| 租户ID | 回滚时间 | 操作人 | 原因 | 指标证据 | 快照时间检查 |\n`;
      md += `|--------|----------|--------|------|----------|--------------|\n`;
      
      batch.rolledBackTenants.forEach(t => {
        md += `| ${t.tenantId} | ${t.rollbackTime} | ${t.operator} | ${t.reason || '-'} | ${t.metricsEvidence ? JSON.stringify(t.metricsEvidence) : '-'} | ${t.snapshotAfterRollback ? '⚠️ 快照晚于回滚' : '✓'} |\n`;
      });
      
      md += `\n---\n\n`;
    });
    
    res.setHeader('Content-Type', 'text/markdown');
    res.send(md);
  } else {
    res.json({
      success: true,
      summary
    });
  }
});

// 11. 获取批次列表
app.get('/api/batches', (req, res) => {
  const batches = [...grayBatches.values()].map(batch => ({
    ...batch,
    tenants: getTenantsInBatch(batch.id),
    rolledBackTenants: getRolledBackTenantsInBatch(batch.id)
  }));
  
  res.json({
    success: true,
    total: batches.length,
    batches
  });
});

// 12. 获取配置版本列表
app.get('/api/configs', (req, res) => {
  const { configKey } = req.query;
  let configs = [...configVersions.values()];
  
  if (configKey) {
    configs = configs.filter(c => c.configKey === configKey);
  }
  
  configs.sort((a, b) => {
    if (a.configKey === b.configKey) {
      return b.version - a.version;
    }
    return a.configKey.localeCompare(b.configKey);
  });
  
  res.json({
    success: true,
    total: configs.length,
    configs
  });
});

// 13. 完成批次（模拟全量发布）
app.post('/api/batches/:batchId/complete', (req, res) => {
  const { batchId } = req.params;
  const { operator = 'system' } = req.body;
  
  const batch = grayBatches.get(batchId);
  if (!batch) {
    return res.status(404).json({ error: `Batch '${batchId}' not found` });
  }
  
  if (batch.status === BATCH_STATUS.ROLLED_BACK) {
    return res.status(400).json({ 
      error: 'Cannot complete a rolled back batch' 
    });
  }
  
  batch.status = BATCH_STATUS.COMPLETED;
  batch.completedAt = currentTime();
  batch.completedBy = operator;
  
  recordAudit('batch_completed', operator, {
    batchId,
    configKey: batch.configKey,
    configVersion: batch.configVersion,
    tenantCount: batch.tenantCount
  });
  
  res.json({
    success: true,
    batch
  });
});

// ==================== 启动服务器 ====================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n🚀 灰度配置回滚 API 服务已启动`);
  console.log(`📍 服务地址: http://localhost:${PORT}`);
  console.log(`\n📋 可用接口:`);
  console.log(`   GET  /api/health                     - 健康检查`);
  console.log(`   POST /api/configs                    - 发布配置版本`);
  console.log(`   POST /api/batches                    - 创建灰度批次`);
  console.log(`   GET  /api/batches                    - 列出所有批次`);
  console.log(`   GET  /api/tenants/:id/config/:key    - 查询租户配置命中`);
  console.log(`   POST /api/metrics                    - 写入指标快照`);
  console.log(`   POST /api/batches/:id/pause          - 暂停灰度`);
  console.log(`   POST /api/batches/:id/complete       - 完成灰度(全量发布)`);
  console.log(`   POST /api/rollbacks/tenant           - 按租户回滚`);
  console.log(`   POST /api/rollbacks/batch            - 整批回滚`);
  console.log(`   GET  /api/audit                      - 查询审计时间线`);
  console.log(`   GET  /api/rollbacks/summary          - 回滚原因汇总`);
  console.log(`\n💡 使用 seed.js 加载演示数据: node seed.js`);
  console.log(`💡 使用 demo.sh 执行完整演示流程\n`);
});

module.exports = app;
