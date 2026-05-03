const { v4: uuidv4 } = require('uuid');
const db = require('./database');

/**
 * 召回匹配数据模型
 */

// 获取所有召回匹配记录
async function getAllRecallMatches() {
  return await db.allQuery(
    `SELECT rm.*, r.recall_code, r.manufacturer, r.recall_reason,
            e.equipment_code, e.batch_number, e.equipment_type, e.model, e.location
     FROM recall_matches rm
     LEFT JOIN recalls r ON rm.recall_id = r.id
     LEFT JOIN equipment e ON rm.equipment_id = e.id
     ORDER BY rm.created_at DESC`
  );
}

// 根据ID获取召回匹配记录
async function getRecallMatchById(id) {
  return await db.getQuery(
    `SELECT rm.*, r.recall_code, r.manufacturer, r.recall_reason,
            e.equipment_code, e.batch_number, e.equipment_type, e.model, e.location
     FROM recall_matches rm
     LEFT JOIN recalls r ON rm.recall_id = r.id
     LEFT JOIN equipment e ON rm.equipment_id = e.id
     WHERE rm.id = ?`,
    [id]
  );
}

// 根据召回ID获取匹配记录
async function getRecallMatchesByRecallId(recallId) {
  return await db.allQuery(
    `SELECT rm.*, e.equipment_code, e.batch_number, e.equipment_type, e.model, e.location
     FROM recall_matches rm
     LEFT JOIN equipment e ON rm.equipment_id = e.id
     WHERE rm.recall_id = ?
     ORDER BY rm.created_at DESC`,
    [recallId]
  );
}

// 根据器材ID获取匹配记录
async function getRecallMatchesByEquipmentId(equipmentId) {
  return await db.allQuery(
    `SELECT rm.*, r.recall_code, r.manufacturer, r.recall_reason, r.deadline_date
     FROM recall_matches rm
     LEFT JOIN recalls r ON rm.recall_id = r.id
     WHERE rm.equipment_id = ?
     ORDER BY rm.created_at DESC`,
    [equipmentId]
  );
}

// 获取未通知的匹配记录
async function getUnnotifiedMatches() {
  return await db.allQuery(
    `SELECT rm.*, r.recall_code, r.manufacturer, r.recall_reason, r.deadline_date,
            e.equipment_code, e.batch_number, e.equipment_type, e.model, e.location
     FROM recall_matches rm
     LEFT JOIN recalls r ON rm.recall_id = r.id
     LEFT JOIN equipment e ON rm.equipment_id = e.id
     WHERE rm.is_notified = 0
     ORDER BY rm.created_at DESC`
  );
}

// 创建召回匹配记录
async function createRecallMatch(matchData) {
  const id = uuidv4();
  const now = new Date().toISOString();
  
  const {
    recall_id,
    equipment_id,
    batch_number,
    match_date = now.split('T')[0],
    is_notified = 0,
    notified_date = null,
    status = 'pending'
  } = matchData;

  await db.runQuery(
    `INSERT INTO recall_matches (
      id, recall_id, equipment_id, batch_number, match_date,
      is_notified, notified_date, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, recall_id, equipment_id, batch_number, match_date,
      is_notified, notified_date, status, now, now
    ]
  );

  return await getRecallMatchById(id);
}

// 批量创建召回匹配记录
async function batchCreateRecallMatches(matchList) {
  const results = [];
  for (const match of matchList) {
    try {
      const created = await createRecallMatch(match);
      results.push({ success: true, data: created });
    } catch (error) {
      results.push({ success: false, error: error.message, data: match });
    }
  }
  return results;
}

// 更新召回匹配记录
async function updateRecallMatch(id, updateData) {
  const now = new Date().toISOString();
  
  const updates = [];
  const values = [];
  
  const allowedFields = [
    'recall_id', 'equipment_id', 'batch_number', 'match_date',
    'is_notified', 'notified_date', 'status'
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
    `UPDATE recall_matches SET ${updates.join(', ')} WHERE id = ?`,
    values
  );
  
  return await getRecallMatchById(id);
}

// 标记为已通知
async function markAsNotified(id, notifiedDate = null) {
  const date = notifiedDate || new Date().toISOString().split('T')[0];
  return await updateRecallMatch(id, {
    is_notified: 1,
    notified_date: date,
    status: 'notified'
  });
}

// 删除召回匹配记录
async function deleteRecallMatch(id) {
  // 先删除相关的派工单
  await db.runQuery('DELETE FROM work_orders WHERE recall_match_id = ?', [id]);
  // 再删除匹配记录
  return await db.runQuery('DELETE FROM recall_matches WHERE id = ?', [id]);
}

// 获取召回匹配统计信息
async function getRecallMatchStats() {
  const total = await db.getQuery('SELECT COUNT(*) as count FROM recall_matches');
  const pending = await db.getQuery("SELECT COUNT(*) as count FROM recall_matches WHERE status = 'pending'");
  const notified = await db.getQuery("SELECT COUNT(*) as count FROM recall_matches WHERE status = 'notified'");
  const completed = await db.getQuery("SELECT COUNT(*) as count FROM recall_matches WHERE status = 'completed'");
  
  return {
    total: total.count,
    pending: pending.count,
    notified: notified.count,
    completed: completed.count
  };
}

module.exports = {
  getAllRecallMatches,
  getRecallMatchById,
  getRecallMatchesByRecallId,
  getRecallMatchesByEquipmentId,
  getUnnotifiedMatches,
  createRecallMatch,
  batchCreateRecallMatches,
  updateRecallMatch,
  markAsNotified,
  deleteRecallMatch,
  getRecallMatchStats
};
