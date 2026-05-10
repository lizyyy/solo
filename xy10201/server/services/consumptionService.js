const { getDatabase } = require('../config/database');
const materialService = require('./materialService');
const treatmentService = require('./treatmentService');

const db = getDatabase();

const STOCK_TRANSITIONS = {
  NORMAL: { from: 'NORMAL', to: 'LOW_STOCK', condition: (m) => m.current_stock < m.min_stock && m.current_stock > 0 },
  LOW: { from: 'LOW_STOCK', to: 'OUT_OF_STOCK', condition: (m) => m.current_stock <= 0 },
  OUT: { from: 'OUT_OF_STOCK', to: 'NORMAL', condition: (m) => m.current_stock >= m.min_stock }
};

function consumeByTreatment(data) {
  const { departmentId, treatmentId, patientName, operator, quantity = 1 } = data;
  
  const treatment = treatmentService.getTreatmentById(treatmentId);
  if (!treatment) throw new Error('诊疗项目不存在');
  
  const stockCheck = treatmentService.checkTreatmentStock(treatmentId);
  if (!stockCheck.can_perform) {
    const shortageInfo = stockCheck.issues.map(i => `${i.material_name}缺${i.shortage}${i.material_name.includes('盒') ? '盒' : '支'}`).join('、');
    throw new Error(`耗材库存不足：${shortageInfo}`, { cause: stockCheck });
  }
  
  const tx = db.transaction(() => {
    const results = [];
    
    for (const tm of treatment.materials) {
      const material = materialService.getMaterialById(tm.material_id);
      const consumeQty = tm.quantity * quantity;
      const totalAmount = material.price * consumeQty;
      
      const stmt = db.prepare(`
        INSERT INTO consumption_records 
          (department_id, treatment_id, patient_name, operator, material_id, 
           quantity, unit_price, total_amount, consumption_type, notes, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'TREATMENT', ?, 'COMPLETED')
      `);
      
      const result = stmt.run(
        departmentId, treatmentId, patientName, operator, tm.material_id,
        consumeQty, material.price, totalAmount,
        `诊疗项目: ${treatment.name}, 患者: ${patientName || '未登记'}`
      );
      
      materialService.updateStock(
        tm.material_id, -consumeQty, 'CONSUMPTION',
        'CONSUMPTION_RECORD', result.lastInsertRowid, operator,
        `诊疗项目消耗：${treatment.name}`
      );
      
      results.push({
        consumption_id: result.lastInsertRowid,
        material_id: tm.material_id,
        material_name: material.name,
        quantity: consumeQty,
        total_amount: totalAmount
      });
    }
    
    materialService.logOperation('CONSUMPTION', 'BY_TREATMENT', 'treatments', treatmentId, null, {
      treatment_name: treatment.name,
      patient: patientName,
      operator,
      materials_count: results.length
    });
    
    return results;
  });
  
  return tx();
}

function consumeByManual(data) {
  const { departmentId, materialId, quantity, operator, notes, patientName } = data;
  
  const material = materialService.getMaterialById(materialId);
  if (!material) throw new Error('耗材不存在');
  
  if (material.current_stock < quantity) {
    throw new Error(`库存不足：当前${material.current_stock}${material.unit}，需要${quantity}${material.unit}`);
  }
  
  const totalAmount = material.price * quantity;
  
  const tx = db.transaction(() => {
    const stmt = db.prepare(`
      INSERT INTO consumption_records 
        (department_id, patient_name, operator, material_id, 
         quantity, unit_price, total_amount, consumption_type, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'MANUAL', ?, 'COMPLETED')
    `);
    
    const result = stmt.run(
      departmentId, patientName || null, operator, materialId,
      quantity, material.price, totalAmount, notes || '手动消耗'
    );
    
    materialService.updateStock(
      materialId, -quantity, 'CONSUMPTION',
      'CONSUMPTION_RECORD', result.lastInsertRowid, operator,
      notes || '手动消耗'
    );
    
    materialService.logOperation('CONSUMPTION', 'MANUAL', 'materials', materialId, null, {
      material_name: material.name,
      quantity,
      operator
    });
    
    return {
      id: result.lastInsertRowid,
      material_id: materialId,
      material_name: material.name,
      quantity,
      total_amount: totalAmount
    };
  });
  
  return tx();
}

function getConsumptionRecords(filters = {}) {
  let sql = `
    SELECT cr.*, 
      m.name as material_name, m.code as material_code, m.unit,
      t.name as treatment_name, d.name as department_name
    FROM consumption_records cr
    JOIN materials m ON m.id = cr.material_id
    JOIN departments d ON d.id = cr.department_id
    LEFT JOIN treatments t ON t.id = cr.treatment_id
    WHERE 1=1
  `;
  const params = [];
  
  if (filters.departmentId) {
    sql += ' AND cr.department_id = ?';
    params.push(filters.departmentId);
  }
  
  if (filters.materialId) {
    sql += ' AND cr.material_id = ?';
    params.push(filters.materialId);
  }
  
  if (filters.treatmentId) {
    sql += ' AND cr.treatment_id = ?';
    params.push(filters.treatmentId);
  }
  
  if (filters.startDate) {
    sql += ' AND DATE(cr.created_at) >= DATE(?)';
    params.push(filters.startDate);
  }
  
  if (filters.endDate) {
    sql += ' AND DATE(cr.created_at) <= DATE(?)';
    params.push(filters.endDate);
  }
  
  sql += ' ORDER BY cr.created_at DESC';
  
  if (filters.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }
  
  return db.prepare(sql).all(...params);
}

function getConsumptionStats(days = 7) {
  return db.prepare(`
    SELECT 
      m.id as material_id, m.name as material_name, m.unit,
      SUM(cr.quantity) as total_consumed,
      SUM(cr.total_amount) as total_amount,
      COUNT(DISTINCT cr.treatment_id) as treatment_count,
      COUNT(DISTINCT DATE(cr.created_at)) as days_used
    FROM consumption_records cr
    JOIN materials m ON m.id = cr.material_id
    WHERE cr.created_at >= datetime('now', ?)
    GROUP BY m.id, m.name, m.unit
    ORDER BY total_consumed DESC
  `).all(`-${days} days`);
}

function getTreatmentConsumptionReport(treatmentId, days = 30) {
  return db.prepare(`
    SELECT 
      m.id as material_id, m.name as material_name, m.unit,
      tm.quantity as standard_quantity,
      COUNT(*) as treatment_count,
      SUM(cr.quantity) as total_used,
      ROUND(SUM(cr.quantity) * 1.0 / COUNT(*), 2) as avg_usage
    FROM consumption_records cr
    JOIN materials m ON m.id = cr.material_id
    JOIN treatments t ON t.id = cr.treatment_id
    LEFT JOIN treatment_materials tm ON tm.treatment_id = t.id AND tm.material_id = m.id
    WHERE cr.treatment_id = ?
      AND cr.created_at >= datetime('now', ?)
    GROUP BY m.id, m.name, m.unit, tm.quantity
    ORDER BY total_used DESC
  `).all(treatmentId, `-${days} days`);
}

function getDepartments() {
  return db.prepare(`SELECT * FROM departments ORDER BY name`).all();
}

module.exports = {
  consumeByTreatment,
  consumeByManual,
  getConsumptionRecords,
  getConsumptionStats,
  getTreatmentConsumptionReport,
  getDepartments,
  STOCK_TRANSITIONS
};
