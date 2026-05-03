const { v4: uuidv4 } = require('uuid');
const db = require('./database');

/**
 * 巡检记录数据模型
 */

// 获取所有巡检记录
async function getAllInspections() {
  return await db.allQuery(
    `SELECT i.*, e.equipment_code, e.batch_number 
     FROM inspections i 
     LEFT JOIN equipment e ON i.equipment_id = e.id 
     ORDER BY i.inspection_date DESC`
  );
}

// 根据ID获取巡检记录
async function getInspectionById(id) {
  return await db.getQuery(
    `SELECT i.*, e.equipment_code, e.batch_number 
     FROM inspections i 
     LEFT JOIN equipment e ON i.equipment_id = e.id 
     WHERE i.id = ?`,
    [id]
  );
}

// 根据器材ID获取巡检记录
async function getInspectionsByEquipmentId(equipmentId) {
  return await db.allQuery(
    `SELECT * FROM inspections 
     WHERE equipment_id = ? 
     ORDER BY inspection_date DESC`,
    [equipmentId]
  );
}

// 获取指定日期范围内的巡检记录
async function getInspectionsByDateRange(startDate, endDate) {
  return await db.allQuery(
    `SELECT i.*, e.equipment_code, e.batch_number 
     FROM inspections i 
     LEFT JOIN equipment e ON i.equipment_id = e.id 
     WHERE i.inspection_date >= ? AND i.inspection_date <= ? 
     ORDER BY i.inspection_date DESC`,
    [startDate, endDate]
  );
}

// 创建巡检记录
async function createInspection(inspectionData) {
  const id = uuidv4();
  const now = new Date().toISOString();
  
  const {
    equipment_id,
    inspection_date,
    inspector,
    status,
    pressure_status,
    hose_status,
    nozzle_status,
    safety_pin_status,
    appearance_status,
    weight_status,
    maintenance_suggestion,
    next_inspection_date
  } = inspectionData;

  await db.runQuery(
    `INSERT INTO inspections (
      id, equipment_id, inspection_date, inspector, status,
      pressure_status, hose_status, nozzle_status, safety_pin_status,
      appearance_status, weight_status, maintenance_suggestion,
      next_inspection_date, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, equipment_id, inspection_date, inspector, status,
      pressure_status, hose_status, nozzle_status, safety_pin_status,
      appearance_status, weight_status, maintenance_suggestion,
      next_inspection_date, now
    ]
  );

  return await getInspectionById(id);
}

// 批量创建巡检记录
async function batchCreateInspections(inspectionList) {
  const results = [];
  for (const inspection of inspectionList) {
    try {
      const created = await createInspection(inspection);
      results.push({ success: true, data: created });
    } catch (error) {
      results.push({ success: false, error: error.message, data: inspection });
    }
  }
  return results;
}

// 更新巡检记录
async function updateInspection(id, updateData) {
  const updates = [];
  const values = [];
  
  const allowedFields = [
    'equipment_id', 'inspection_date', 'inspector', 'status',
    'pressure_status', 'hose_status', 'nozzle_status', 'safety_pin_status',
    'appearance_status', 'weight_status', 'maintenance_suggestion',
    'next_inspection_date'
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
  
  values.push(id);
  
  await db.runQuery(
    `UPDATE inspections SET ${updates.join(', ')} WHERE id = ?`,
    values
  );
  
  return await getInspectionById(id);
}

// 删除巡检记录
async function deleteInspection(id) {
  return await db.runQuery('DELETE FROM inspections WHERE id = ?', [id]);
}

// 获取巡检统计信息
async function getInspectionStats() {
  const total = await db.getQuery('SELECT COUNT(*) as count FROM inspections');
  const passed = await db.getQuery("SELECT COUNT(*) as count FROM inspections WHERE status = 'normal' OR status = 'good'");
  const failed = await db.getQuery("SELECT COUNT(*) as count FROM inspections WHERE status = 'faulty' OR status = 'needs_repair'");
  
  return {
    total: total.count,
    passed: passed.count,
    failed: failed.count
  };
}

module.exports = {
  getAllInspections,
  getInspectionById,
  getInspectionsByEquipmentId,
  getInspectionsByDateRange,
  createInspection,
  batchCreateInspections,
  updateInspection,
  deleteInspection,
  getInspectionStats
};
