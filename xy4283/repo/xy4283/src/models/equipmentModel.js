const { v4: uuidv4 } = require('uuid');
const db = require('./database');

/**
 * 器材台账数据模型
 */

// 获取所有器材
async function getAllEquipment() {
  return await db.allQuery('SELECT * FROM equipment ORDER BY created_at DESC');
}

// 根据ID获取器材
async function getEquipmentById(id) {
  return await db.getQuery('SELECT * FROM equipment WHERE id = ?', [id]);
}

// 根据器材编号获取器材
async function getEquipmentByCode(equipmentCode) {
  return await db.getQuery('SELECT * FROM equipment WHERE equipment_code = ?', [equipmentCode]);
}

// 根据批次号获取器材
async function getEquipmentByBatch(batchNumber) {
  return await db.allQuery('SELECT * FROM equipment WHERE batch_number = ?', [batchNumber]);
}

// 获取已报废器材
async function getScrappedEquipment() {
  return await db.allQuery('SELECT * FROM equipment WHERE is_scrapped = 1');
}

// 获取未报废器材
async function getActiveEquipment() {
  return await db.allQuery('SELECT * FROM equipment WHERE is_scrapped = 0');
}

// 创建器材
async function createEquipment(equipmentData) {
  const id = uuidv4();
  const now = new Date().toISOString();
  
  const {
    equipment_code,
    batch_number,
    equipment_type,
    model,
    manufacturer,
    production_date,
    purchase_date,
    expiration_date,
    location,
    status = 'normal',
    is_scrapped = 0,
    scrapped_date
  } = equipmentData;

  await db.runQuery(
    `INSERT INTO equipment (
      id, equipment_code, batch_number, equipment_type, model, manufacturer,
      production_date, purchase_date, expiration_date, location, status,
      is_scrapped, scrapped_date, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, equipment_code, batch_number, equipment_type, model, manufacturer,
      production_date, purchase_date, expiration_date, location, status,
      is_scrapped, scrapped_date, now, now
    ]
  );

  return await getEquipmentById(id);
}

// 批量创建器材
async function batchCreateEquipment(equipmentList) {
  const results = [];
  for (const equipment of equipmentList) {
    try {
      const created = await createEquipment(equipment);
      results.push({ success: true, data: created });
    } catch (error) {
      results.push({ success: false, error: error.message, data: equipment });
    }
  }
  return results;
}

// 更新器材
async function updateEquipment(id, updateData) {
  const now = new Date().toISOString();
  
  const updates = [];
  const values = [];
  
  // 动态构建更新语句
  const allowedFields = [
    'equipment_code', 'batch_number', 'equipment_type', 'model', 'manufacturer',
    'production_date', 'purchase_date', 'expiration_date', 'location', 'status',
    'is_scrapped', 'scrapped_date'
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
    `UPDATE equipment SET ${updates.join(', ')} WHERE id = ?`,
    values
  );
  
  return await getEquipmentById(id);
}

// 报废器材
async function scrapEquipment(id, scrappedDate = null) {
  const date = scrappedDate || new Date().toISOString().split('T')[0];
  return await updateEquipment(id, {
    is_scrapped: 1,
    scrapped_date: date,
    status: 'scrapped'
  });
}

// 删除器材（软删除，实际标记为报废）
async function deleteEquipment(id) {
  return await scrapEquipment(id);
}

// 获取器材统计信息
async function getEquipmentStats() {
  const total = await db.getQuery('SELECT COUNT(*) as count FROM equipment');
  const scrapped = await db.getQuery('SELECT COUNT(*) as count FROM equipment WHERE is_scrapped = 1');
  const active = await db.getQuery('SELECT COUNT(*) as count FROM equipment WHERE is_scrapped = 0');
  
  return {
    total: total.count,
    scrapped: scrapped.count,
    active: active.count
  };
}

module.exports = {
  getAllEquipment,
  getEquipmentById,
  getEquipmentByCode,
  getEquipmentByBatch,
  getScrappedEquipment,
  getActiveEquipment,
  createEquipment,
  batchCreateEquipment,
  updateEquipment,
  scrapEquipment,
  deleteEquipment,
  getEquipmentStats
};
