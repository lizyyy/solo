const { getDatabase } = require('../config/database');
const materialService = require('./materialService');

const db = getDatabase();

function getTreatmentById(id) {
  const treatment = db.prepare(`
    SELECT t.*
    FROM treatments t
    WHERE t.id = ?
  `).get(id);
  
  if (treatment) {
    treatment.materials = db.prepare(`
      SELECT tm.*, m.name as material_name, m.code as material_code, m.unit, m.current_stock, m.price,
        CASE WHEN m.current_stock <= 0 THEN 'OUT_OF_STOCK'
             WHEN m.current_stock < m.min_stock THEN 'LOW_STOCK'
             ELSE 'NORMAL'
        END as material_stock_status
      FROM treatment_materials tm
      JOIN materials m ON m.id = tm.material_id
      WHERE tm.treatment_id = ?
    `).all(id);
  }
  
  return treatment;
}

function getAllTreatments(activeOnly = false) {
  let sql = `SELECT t.* FROM treatments t`;
  if (activeOnly) sql += ' WHERE t.is_active = 1';
  sql += ' ORDER BY t.name';
  
  return db.prepare(sql).all();
}

function createTreatment(data) {
  const stmt = db.prepare(`
    INSERT INTO treatments (name, code, description, duration_minutes, is_active)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    data.name, data.code, data.description, 
    data.duration_minutes, data.is_active !== undefined ? data.is_active : 1
  );
  
  const treatmentId = result.lastInsertRowid;
  
  if (data.materials && data.materials.length > 0) {
    const bindStmt = db.prepare(`
      INSERT INTO treatment_materials (treatment_id, material_id, quantity, notes)
      VALUES (?, ?, ?, ?)
    `);
    
    data.materials.forEach(m => {
      bindStmt.run(treatmentId, m.material_id, m.quantity || 1, m.notes);
    });
  }
  
  materialService.logOperation('TREATMENT', 'CREATE', 'treatments', treatmentId, null, data);
  
  return getTreatmentById(treatmentId);
}

function updateTreatment(id, data) {
  const before = getTreatmentById(id);
  if (!before) throw new Error('诊疗项目不存在');
  
  db.prepare(`
    UPDATE treatments SET 
      name = ?, description = ?, duration_minutes = ?, 
      is_active = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    data.name, data.description, data.duration_minutes,
    data.is_active !== undefined ? data.is_active : 1, id
  );
  
  if (data.materials !== undefined) {
    db.prepare(`DELETE FROM treatment_materials WHERE treatment_id = ?`).run(id);
    
    if (data.materials && data.materials.length > 0) {
      const bindStmt = db.prepare(`
        INSERT INTO treatment_materials (treatment_id, material_id, quantity, notes)
        VALUES (?, ?, ?, ?)
      `);
      
      data.materials.forEach(m => {
        bindStmt.run(id, m.material_id, m.quantity || 1, m.notes);
      });
    }
  }
  
  const after = getTreatmentById(id);
  materialService.logOperation('TREATMENT', 'UPDATE', 'treatments', id, before, after);
  
  return after;
}

function bindMaterials(treatmentId, materials) {
  const tx = db.transaction((items) => {
    db.prepare(`DELETE FROM treatment_materials WHERE treatment_id = ?`).run(treatmentId);
    
    const bindStmt = db.prepare(`
      INSERT INTO treatment_materials (treatment_id, material_id, quantity, notes)
      VALUES (?, ?, ?, ?)
    `);
    
    items.forEach(m => {
      bindStmt.run(treatmentId, m.material_id, m.quantity || 1, m.notes);
    });
  });
  
  tx(materials);
  materialService.logOperation('TREATMENT', 'BIND_MATERIALS', 'treatments', treatmentId, null, { materials });
  
  return getTreatmentById(treatmentId);
}

function checkTreatmentStock(treatmentId) {
  const treatment = getTreatmentById(treatmentId);
  if (!treatment) throw new Error('诊疗项目不存在');
  
  const issues = [];
  
  treatment.materials.forEach(tm => {
    if (tm.current_stock < tm.quantity) {
      issues.push({
        material_id: tm.material_id,
        material_name: tm.material_name,
        needed: tm.quantity,
        available: tm.current_stock,
        shortage: tm.quantity - tm.current_stock,
        stock_status: tm.material_stock_status
      });
    }
  });
  
  return {
    treatment_id: treatmentId,
    treatment_name: treatment.name,
    can_perform: issues.length === 0,
    shortage_count: issues.length,
    issues
  };
}

function getTreatmentMaterialSummary(treatmentId) {
  const treatment = getTreatmentById(treatmentId);
  if (!treatment) return null;
  
  let totalCost = 0;
  treatment.materials.forEach(tm => {
    totalCost += tm.price * tm.quantity;
  });
  
  return {
    treatment_id: treatment.id,
    treatment_name: treatment.name,
    material_count: treatment.materials.length,
    estimated_cost: totalCost,
    materials: treatment.materials
  };
}

module.exports = {
  getTreatmentById,
  getAllTreatments,
  createTreatment,
  updateTreatment,
  bindMaterials,
  checkTreatmentStock,
  getTreatmentMaterialSummary
};
