const { v4: uuidv4 } = require('uuid');
const db = require('./database');

/**
 * 逾期风险记录数据模型
 */

// 风险等级常量
const RISK_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

// 实体类型常量
const OVERDUE_ENTITY_TYPES = {
  WORK_ORDER: 'work_order',
  RECALL: 'recall',
  INSPECTION: 'inspection'
};

// 获取所有逾期风险记录
async function getAllOverdueRisks() {
  return await db.allQuery(
    `SELECT * FROM overdue_risks ORDER BY created_at DESC`
  );
}

// 根据ID获取逾期风险记录
async function getOverdueRiskById(id) {
  return await db.getQuery(
    `SELECT * FROM overdue_risks WHERE id = ?`,
    [id]
  );
}

// 根据实体类型和ID获取逾期风险
async function getOverdueRiskByEntity(entityType, entityId) {
  return await db.getQuery(
    `SELECT * FROM overdue_risks 
     WHERE entity_type = ? AND entity_id = ?`,
    [entityType, entityId]
  );
}

// 获取未解决的逾期风险
async function getUnresolvedOverdueRisks() {
  return await db.allQuery(
    `SELECT * FROM overdue_risks 
     WHERE is_resolved = 0 
     ORDER BY risk_level DESC, days_overdue DESC`
  );
}

// 根据风险等级获取逾期风险
async function getOverdueRisksByLevel(riskLevel) {
  return await db.allQuery(
    `SELECT * FROM overdue_risks 
     WHERE risk_level = ? AND is_resolved = 0 
     ORDER BY days_overdue DESC`,
    [riskLevel]
  );
}

// 创建逾期风险记录
async function createOverdueRisk(riskData) {
  const id = uuidv4();
  const now = new Date().toISOString();
  
  const {
    entity_type,
    entity_id,
    deadline_date,
    risk_level,
    days_overdue = 0,
    is_resolved = 0,
    resolved_date = null
  } = riskData;

  // 检查是否已存在记录
  const existing = await getOverdueRiskByEntity(entity_type, entity_id);
  
  if (existing) {
    // 如果已存在，更新现有记录
    return await updateOverdueRisk(existing.id, {
      deadline_date,
      risk_level,
      days_overdue,
      is_resolved,
      resolved_date
    });
  }

  await db.runQuery(
    `INSERT INTO overdue_risks (
      id, entity_type, entity_id, deadline_date, risk_level,
      days_overdue, is_resolved, resolved_date, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, entity_type, entity_id, deadline_date, risk_level,
      days_overdue, is_resolved, resolved_date, now, now
    ]
  );

  return await getOverdueRiskById(id);
}

// 批量创建逾期风险记录
async function batchCreateOverdueRisks(riskList) {
  const results = [];
  for (const risk of riskList) {
    try {
      const created = await createOverdueRisk(risk);
      results.push({ success: true, data: created });
    } catch (error) {
      results.push({ success: false, error: error.message, data: risk });
    }
  }
  return results;
}

// 更新逾期风险记录
async function updateOverdueRisk(id, updateData) {
  const now = new Date().toISOString();
  
  const updates = [];
  const values = [];
  
  const allowedFields = [
    'entity_type', 'entity_id', 'deadline_date', 'risk_level',
    'days_overdue', 'is_resolved', 'resolved_date'
  ];
  
  for (const [key, value] of Object.entries(updateData)) {
    if (allowedFields.includes(key) && value !== undefined) {
      updates.push(`${key} = ?`);
      values.push(value);
    }
  }
  
  if (updates.length === 0) {
    throw new Error('没有需要更新的字段');
  }
  
  updates.push('updated_at = ?');
  values.push(now);
  values.push(id);
  
  await db.runQuery(
    `UPDATE overdue_risks SET ${updates.join(', ')} WHERE id = ?`,
    values
  );
  
  return await getOverdueRiskById(id);
}

// 标记为已解决
async function markAsResolved(id, resolvedDate = null) {
  const date = resolvedDate || new Date().toISOString().split('T')[0];
  return await updateOverdueRisk(id, {
    is_resolved: 1,
    resolved_date: date
  });
}

// 删除逾期风险记录
async function deleteOverdueRisk(id) {
  return await db.runQuery('DELETE FROM overdue_risks WHERE id = ?', [id]);
}

// 获取逾期风险统计信息
async function getOverdueRiskStats() {
  const total = await db.getQuery('SELECT COUNT(*) as count FROM overdue_risks');
  const unresolved = await db.getQuery('SELECT COUNT(*) as count FROM overdue_risks WHERE is_resolved = 0');
  const resolved = await db.getQuery('SELECT COUNT(*) as count FROM overdue_risks WHERE is_resolved = 1');
  
  const byLevel = await db.allQuery(
    `SELECT risk_level, COUNT(*) as count 
     FROM overdue_risks 
     WHERE is_resolved = 0 
     GROUP BY risk_level`
  );
  
  const critical = await db.getQuery(`SELECT COUNT(*) as count FROM overdue_risks WHERE risk_level = '${RISK_LEVELS.CRITICAL}' AND is_resolved = 0`);
  const high = await db.getQuery(`SELECT COUNT(*) as count FROM overdue_risks WHERE risk_level = '${RISK_LEVELS.HIGH}' AND is_resolved = 0`);
  const medium = await db.getQuery(`SELECT COUNT(*) as count FROM overdue_risks WHERE risk_level = '${RISK_LEVELS.MEDIUM}' AND is_resolved = 0`);
  const low = await db.getQuery(`SELECT COUNT(*) as count FROM overdue_risks WHERE risk_level = '${RISK_LEVELS.LOW}' AND is_resolved = 0`);
  
  return {
    total: total.count,
    unresolved: unresolved.count,
    resolved: resolved.count,
    byLevel: byLevel.reduce((acc, item) => {
      acc[item.risk_level] = item.count;
      return acc;
    }, {}),
    detailed: {
      critical: critical.count,
      high: high.count,
      medium: medium.count,
      low: low.count
    }
  };
}

module.exports = {
  RISK_LEVELS,
  OVERDUE_ENTITY_TYPES,
  getAllOverdueRisks,
  getOverdueRiskById,
  getOverdueRiskByEntity,
  getUnresolvedOverdueRisks,
  getOverdueRisksByLevel,
  createOverdueRisk,
  batchCreateOverdueRisks,
  updateOverdueRisk,
  markAsResolved,
  deleteOverdueRisk,
  getOverdueRiskStats
};
