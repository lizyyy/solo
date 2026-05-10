const { getDatabase } = require('../config/database');

const db = getDatabase();

function getMaterialById(id) {
  return db.prepare(`
    SELECT m.*, 
      CASE WHEN m.current_stock <= 0 THEN 'OUT_OF_STOCK'
           WHEN m.current_stock < m.min_stock THEN 'LOW_STOCK'
           WHEN m.current_stock >= m.max_stock THEN 'OVER_STOCK'
           ELSE 'NORMAL'
      END AS stock_status
    FROM materials m
    WHERE m.id = ?
  `).get(id);
}

function getLowStockMaterials() {
  return db.prepare(`
    SELECT m.*, 
      CASE WHEN m.current_stock <= 0 THEN 'OUT_OF_STOCK'
           WHEN m.current_stock < m.min_stock THEN 'LOW_STOCK'
           WHEN m.current_stock >= m.max_stock THEN 'OVER_STOCK'
           ELSE 'NORMAL'
      END AS stock_status
    FROM materials m
    WHERE m.current_stock < m.min_stock
    ORDER BY m.current_stock ASC
  `).all();
}

function getAllMaterials(filters = {}) {
  let sql = `
    SELECT m.*, 
      CASE WHEN m.current_stock <= 0 THEN 'OUT_OF_STOCK'
           WHEN m.current_stock < m.min_stock THEN 'LOW_STOCK'
           WHEN m.current_stock >= m.max_stock THEN 'OVER_STOCK'
           ELSE 'NORMAL'
      END AS stock_status
    FROM materials m
    WHERE 1=1
  `;
  const params = [];
  
  if (filters.category) {
    sql += ' AND m.category = ?';
    params.push(filters.category);
  }
  
  if (filters.keyword) {
    sql += ' AND (m.name LIKE ? OR m.code LIKE ?)';
    params.push(`%${filters.keyword}%`, `%${filters.keyword}%`);
  }
  
  sql += ' ORDER BY m.updated_at DESC';
  
  return db.prepare(sql).all(...params);
}

function createMaterial(data) {
  const stmt = db.prepare(`
    INSERT INTO materials (name, code, unit, category, current_stock, min_stock, max_stock, price, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    data.name, data.code, data.unit, data.category,
    data.current_stock || 0, data.min_stock || 10, 
    data.max_stock || 100, data.price || 0, data.description
  );
  
  logOperation('MATERIAL', 'CREATE', 'materials', result.lastInsertRowid, null, data);
  
  return getMaterialById(result.lastInsertRowid);
}

function updateMaterial(id, data) {
  const before = getMaterialById(id);
  if (!before) throw new Error('耗材不存在');
  
  const stmt = db.prepare(`
    UPDATE materials SET 
      name = ?, unit = ?, category = ?, min_stock = ?, max_stock = ?, 
      price = ?, description = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  stmt.run(
    data.name, data.unit, data.category,
    data.min_stock, data.max_stock, data.price, data.description, id
  );
  
  const after = getMaterialById(id);
  logOperation('MATERIAL', 'UPDATE', 'materials', id, before, after);
  
  return after;
}

function updateStock(materialId, changeQuantity, snapshotType, referenceType, referenceId, operator, notes = '') {
  const material = getMaterialById(materialId);
  if (!material) throw new Error('耗材不存在');
  
  const beforeQuantity = material.current_stock;
  const afterQuantity = beforeQuantity + changeQuantity;
  
  if (afterQuantity < 0) {
    throw new Error(`库存不足：当前${beforeQuantity}，需要${Math.abs(changeQuantity)}`);
  }
  
  db.prepare(`
    UPDATE materials SET current_stock = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(afterQuantity, materialId);
  
  db.prepare(`
    INSERT INTO inventory_snapshots 
      (material_id, snapshot_type, before_quantity, change_quantity, after_quantity, 
       reference_type, reference_id, operator, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    materialId, snapshotType, beforeQuantity, changeQuantity, afterQuantity,
    referenceType, referenceId, operator, notes
  );
  
  const updatedMaterial = getMaterialById(materialId);
  logOperation('INVENTORY', snapshotType, 'materials', materialId, 
    { current_stock: beforeQuantity }, { current_stock: afterQuantity }, operator);
  
  return {
    material: updatedMaterial,
    before: beforeQuantity,
    change: changeQuantity,
    after: afterQuantity
  };
}

function getMaterialHistory(materialId, limit = 20) {
  return db.prepare(`
    SELECT s.*, m.name as material_name
    FROM inventory_snapshots s
    JOIN materials m ON m.id = s.material_id
    WHERE s.material_id = ?
    ORDER BY s.created_at DESC
    LIMIT ?
  `).all(materialId, limit);
}

function getMaterialCategories() {
  return db.prepare(`
    SELECT DISTINCT category FROM materials ORDER BY category
  `).all().map(r => r.category);
}

function logOperation(module, action, targetType, targetId, beforeData, afterData, operator = 'system') {
  db.prepare(`
    INSERT INTO operation_logs (module, action, target_type, target_id, before_data, after_data, operator)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    module, action, targetType, targetId,
    beforeData ? JSON.stringify(beforeData) : null,
    afterData ? JSON.stringify(afterData) : null,
    operator
  );
}

module.exports = {
  getMaterialById,
  getAllMaterials,
  getLowStockMaterials,
  createMaterial,
  updateMaterial,
  updateStock,
  getMaterialHistory,
  getMaterialCategories,
  logOperation
};
