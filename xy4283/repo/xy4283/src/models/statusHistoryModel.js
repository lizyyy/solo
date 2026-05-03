const { v4: uuidv4 } = require('uuid');
const db = require('./database');

/**
 * 状态流转记录数据模型
 */

// 实体类型常量
const ENTITY_TYPES = {
  WORK_ORDER: 'work_order',
  RECALL_MATCH: 'recall_match',
  EQUIPMENT: 'equipment',
  RECALL: 'recall'
};

// 获取所有状态历史记录
async function getAllStatusHistory() {
  return await db.allQuery(
    `SELECT * FROM status_history ORDER BY created_at DESC`
  );
}

// 根据ID获取状态历史记录
async function getStatusHistoryById(id) {
  return await db.getQuery(
    `SELECT * FROM status_history WHERE id = ?`,
    [id]
  );
}

// 根据实体类型和ID获取状态历史
async function getStatusHistoryByEntity(entityType, entityId) {
  return await db.allQuery(
    `SELECT * FROM status_history 
     WHERE entity_type = ? AND entity_id = ? 
     ORDER BY created_at ASC`,
    [entityType, entityId]
  );
}

// 获取实体的当前状态
async function getCurrentStatus(entityType, entityId) {
  const history = await db.allQuery(
    `SELECT * FROM status_history 
     WHERE entity_type = ? AND entity_id = ? 
     ORDER BY created_at DESC 
     LIMIT 1`,
    [entityType, entityId]
  );
  
  return history.length > 0 ? history[0] : null;
}

// 创建状态历史记录
async function createStatusHistory(historyData) {
  const id = uuidv4();
  const now = new Date().toISOString();
  
  const {
    entity_type,
    entity_id,
    from_status = null,
    to_status,
    changed_by = null,
    change_reason = null
  } = historyData;

  await db.runQuery(
    `INSERT INTO status_history (
      id, entity_type, entity_id, from_status, to_status,
      changed_by, change_reason, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, entity_type, entity_id, from_status, to_status,
      changed_by, change_reason, now
    ]
  );

  return await getStatusHistoryById(id);
}

// 批量创建状态历史记录
async function batchCreateStatusHistory(historyList) {
  const results = [];
  for (const history of historyList) {
    try {
      const created = await createStatusHistory(history);
      results.push({ success: true, data: created });
    } catch (error) {
      results.push({ success: false, error: error.message, data: history });
    }
  }
  return results;
}

// 删除状态历史记录（通常只用于清理）
async function deleteStatusHistory(id) {
  return await db.runQuery('DELETE FROM status_history WHERE id = ?', [id]);
}

// 删除实体的所有状态历史
async function deleteEntityHistory(entityType, entityId) {
  return await db.runQuery(
    'DELETE FROM status_history WHERE entity_type = ? AND entity_id = ?',
    [entityType, entityId]
  );
}

// 获取状态历史统计
async function getStatusHistoryStats() {
  const total = await db.getQuery('SELECT COUNT(*) as count FROM status_history');
  
  const byEntityType = await db.allQuery(
    `SELECT entity_type, COUNT(*) as count 
     FROM status_history 
     GROUP BY entity_type`
  );
  
  const byStatus = await db.allQuery(
    `SELECT to_status, COUNT(*) as count 
     FROM status_history 
     GROUP BY to_status`
  );
  
  return {
    total: total.count,
    byEntityType: byEntityType.reduce((acc, item) => {
      acc[item.entity_type] = item.count;
      return acc;
    }, {}),
    byStatus: byStatus.reduce((acc, item) => {
      acc[item.to_status] = item.count;
      return acc;
    }, {})
  };
}

module.exports = {
  ENTITY_TYPES,
  getAllStatusHistory,
  getStatusHistoryById,
  getStatusHistoryByEntity,
  getCurrentStatus,
  createStatusHistory,
  batchCreateStatusHistory,
  deleteStatusHistory,
  deleteEntityHistory,
  getStatusHistoryStats
};
