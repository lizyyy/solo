const { getDb } = require('../database');
const { v4: uuidv4 } = require('uuid');
const qualificationService = require('./qualification-service');
const exceptionService = require('./exception-service');

async function addRisk(params) {
  const db = getDb();
  const { supplier_id, risk_type, description, severity = 'medium' } = params;
  
  if (!supplier_id || !risk_type) {
    await exceptionService.recordException({
      type: 'validation_error',
      severity: 'low',
      supplier_id,
      error: '风险信息不完整',
      raw_data: params
    });
    throw new Error('供应商ID和风险类型为必填项');
  }
  
  const supplier = await qualificationService.getSupplierById(supplier_id);
  if (!supplier) {
    await exceptionService.recordException({
      type: 'data_not_found',
      severity: 'medium',
      supplier_id,
      error: '供应商不存在',
      raw_data: params
    });
    throw new Error('供应商不存在');
  }
  
  const id = 'risk_' + uuidv4().substring(0, 8);
  
  await db.run(`
    INSERT INTO risk_list (id, supplier_id, risk_type, description, severity, status)
    VALUES (?, ?, ?, ?, ?, 'active')
  `, [id, supplier_id, risk_type, description, severity]);
  
  if (severity === 'high') {
    await qualificationService.freezeSupplier(
      supplier_id, 
      `高风险事件: ${risk_type} - ${description || '未描述'}`,
      null
    );
  } else if (severity === 'critical') {
    await qualificationService.freezeSupplier(
      supplier_id, 
      `严重风险事件: ${risk_type} - ${description || '未描述'}`,
      null
    );
  }
  
  await exceptionService.recordException({
    type: 'risk_added',
    severity: severity,
    supplier_id,
    error: `新增风险: ${risk_type}`,
    raw_data: params
  });
  
  return getRiskById(id);
}

async function getRiskById(id) {
  const db = getDb();
  return db.get('SELECT * FROM risk_list WHERE id = ?', [id]);
}

async function getRisksBySupplier(supplier_id, active_only = true) {
  const db = getDb();
  let sql = 'SELECT * FROM risk_list WHERE supplier_id = ?';
  const values = [supplier_id];
  
  if (active_only) {
    sql += " AND status = 'active'";
  }
  sql += ' ORDER BY created_at DESC';
  
  return db.all(sql, values);
}

async function resolveRisk(id, resolution_notes) {
  const db = getDb();
  
  const risk = await getRiskById(id);
  if (!risk) {
    throw new Error('风险记录不存在');
  }
  
  if (risk.status !== 'active') {
    await exceptionService.recordException({
      type: 'business_warning',
      severity: 'low',
      supplier_id: risk.supplier_id,
      error: '该风险已处理',
      raw_data: { id, risk }
    });
    throw new Error('该风险已处理');
  }
  
  await db.run(`
    UPDATE risk_list 
    SET status = 'resolved', updated_at = datetime('now')
    WHERE id = ?
  `, [id]);
  
  const statusCheck = await qualificationService.checkSupplierStatus(risk.supplier_id);
  
  if (statusCheck.expired_qualifications.length === 0 && 
      statusCheck.active_risks.length === 0) {
    const supplier = await qualificationService.getSupplierById(risk.supplier_id);
    if (supplier.status === 'frozen') {
      await qualificationService.unfreezeSupplier(risk.supplier_id, `风险已解决: ${risk.risk_type}`);
    }
  }
  
  await exceptionService.recordException({
    type: 'business_event',
    severity: 'low',
    supplier_id: risk.supplier_id,
    error: `风险已解决: ${risk.risk_type}`,
    raw_data: { id, resolution_notes }
  });
  
  return getRiskById(id);
}

async function getAllActiveRisks() {
  const db = getDb();
  return db.all(`
    SELECT rl.*, s.name as supplier_name
    FROM risk_list rl
    JOIN suppliers s ON rl.supplier_id = s.id
    WHERE rl.status = 'active'
    ORDER BY 
      CASE rl.severity 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        WHEN 'low' THEN 4 
      END,
      rl.created_at DESC
  `);
}

async function getRiskSummary() {
  const db = getDb();
  
  const stats = await db.all(`
    SELECT 
      severity,
      COUNT(*) as count
    FROM risk_list
    WHERE status = 'active'
    GROUP BY severity
    ORDER BY severity DESC
  `);
  
  const total = stats.reduce((sum, s) => sum + s.count, 0);
  
  return {
    total_active: total,
    by_severity: stats,
    details: await getAllActiveRisks()
  };
}

module.exports = {
  addRisk,
  getRiskById,
  getRisksBySupplier,
  resolveRisk,
  getAllActiveRisks,
  getRiskSummary
};
