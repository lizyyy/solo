const { v4: uuidv4 } = require('uuid');
const db = require('./database');

/**
 * 厂家召回清单数据模型
 */

// 获取所有召回清单
async function getAllRecalls() {
  return await db.allQuery('SELECT * FROM recalls ORDER BY created_at DESC');
}

// 根据ID获取召回清单
async function getRecallById(id) {
  return await db.getQuery('SELECT * FROM recalls WHERE id = ?', [id]);
}

// 根据召回编号获取召回清单
async function getRecallByCode(recallCode) {
  return await db.getQuery('SELECT * FROM recalls WHERE recall_code = ?', [recallCode]);
}

// 获取激活状态的召回清单
async function getActiveRecalls() {
  return await db.allQuery("SELECT * FROM recalls WHERE status = 'active' ORDER BY created_at DESC");
}

// 创建召回清单
async function createRecall(recallData) {
  const id = uuidv4();
  const now = new Date().toISOString();
  
  const {
    recall_code,
    manufacturer,
    recall_reason,
    recall_date,
    deadline_date,
    affected_batches,
    status = 'active'
  } = recallData;

  // 将批次号数组转换为JSON字符串存储
  const batchesJson = Array.isArray(affected_batches) 
    ? JSON.stringify(affected_batches) 
    : affected_batches;

  await db.runQuery(
    `INSERT INTO recalls (
      id, recall_code, manufacturer, recall_reason, recall_date,
      deadline_date, affected_batches, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, recall_code, manufacturer, recall_reason, recall_date,
      deadline_date, batchesJson, status, now, now
    ]
  );

  return await getRecallById(id);
}

// 批量创建召回清单
async function batchCreateRecalls(recallList) {
  const results = [];
  for (const recall of recallList) {
    try {
      const created = await createRecall(recall);
      results.push({ success: true, data: created });
    } catch (error) {
      results.push({ success: false, error: error.message, data: recall });
    }
  }
  return results;
}

// 更新召回清单
async function updateRecall(id, updateData) {
  const now = new Date().toISOString();
  
  const updates = [];
  const values = [];
  
  const allowedFields = [
    'recall_code', 'manufacturer', 'recall_reason', 'recall_date',
    'deadline_date', 'affected_batches', 'status'
  ];
  
  for (const [key, value] of Object.entries(updateData)) {
    if (allowedFields.includes(key) && value !== undefined) {
      if (key === 'affected_batches' && Array.isArray(value)) {
        updates.push(`${key} = ?`);
        values.push(JSON.stringify(value));
      } else {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }
  }
  
  if (updates.length === 0) {
    throw new Error('没有需要更新的字段');
  }
  
  updates.push('updated_at = ?');
  values.push(now);
  values.push(id);
  
  await db.runQuery(
    `UPDATE recalls SET ${updates.join(', ')} WHERE id = ?`,
    values
  );
  
  return await getRecallById(id);
}

// 关闭召回清单
async function closeRecall(id) {
  return await updateRecall(id, { status: 'closed' });
}

// 删除召回清单
async function deleteRecall(id) {
  // 先删除相关的召回匹配记录
  await db.runQuery('DELETE FROM recall_matches WHERE recall_id = ?', [id]);
  // 再删除召回清单
  return await db.runQuery('DELETE FROM recalls WHERE id = ?', [id]);
}

// 获取召回统计信息
async function getRecallStats() {
  const total = await db.getQuery('SELECT COUNT(*) as count FROM recalls');
  const active = await db.getQuery("SELECT COUNT(*) as count FROM recalls WHERE status = 'active'");
  const closed = await db.getQuery("SELECT COUNT(*) as count FROM recalls WHERE status = 'closed'");
  
  return {
    total: total.count,
    active: active.count,
    closed: closed.count
  };
}

module.exports = {
  getAllRecalls,
  getRecallById,
  getRecallByCode,
  getActiveRecalls,
  createRecall,
  batchCreateRecalls,
  updateRecall,
  closeRecall,
  deleteRecall,
  getRecallStats
};
