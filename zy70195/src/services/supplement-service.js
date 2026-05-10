const { getDb } = require('../database');
const { v4: uuidv4 } = require('uuid');
const qualificationService = require('./qualification-service');
const exceptionService = require('./exception-service');

async function createSupplement(params) {
  const db = getDb();
  const { supplier_id, qualification_id, reason } = params;
  
  if (!supplier_id || !qualification_id) {
    await exceptionService.recordException({
      type: 'validation_error',
      severity: 'low',
      supplier_id,
      qualification_id,
      error: '补证申请信息不完整',
      raw_data: params
    });
    throw new Error('供应商ID和资质ID为必填项');
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
  
  const qualification = await qualificationService.getQualificationById(qualification_id);
  if (!qualification) {
    await exceptionService.recordException({
      type: 'data_not_found',
      severity: 'medium',
      supplier_id,
      qualification_id,
      error: '资质档案不存在',
      raw_data: params
    });
    throw new Error('资质档案不存在');
  }
  
  const existing = await db.get(`
    SELECT * FROM supplement_requests 
    WHERE qualification_id = ? AND status = 'pending'
  `, [qualification_id]);
  
  if (existing) {
    throw new Error('该资质已有待处理的补证申请');
  }
  
  const id = 'supp_' + uuidv4().substring(0, 8);
  
  await db.run(`
    INSERT INTO supplement_requests (id, supplier_id, qualification_id, reason)
    VALUES (?, ?, ?, ?)
  `, [id, supplier_id, qualification_id, reason]);
  
  await exceptionService.recordException({
    type: 'business_event',
    severity: 'low',
    supplier_id,
    qualification_id,
    error: '创建补证申请',
    raw_data: params
  });
  
  return getSupplementById(id);
}

async function getSupplementById(id) {
  const db = getDb();
  return db.get(`
    SELECT sr.*, s.name as supplier_name, q.name as qualification_name, 
           q.type as qualification_type, q.expiry_date as original_expiry
    FROM supplement_requests sr
    JOIN suppliers s ON sr.supplier_id = s.id
    JOIN qualifications q ON sr.qualification_id = q.id
    WHERE sr.id = ?
  `, [id]);
}

async function getAllSupplements() {
  const db = getDb();
  return db.all(`
    SELECT sr.*, s.name as supplier_name, q.name as qualification_name
    FROM supplement_requests sr
    JOIN suppliers s ON sr.supplier_id = s.id
    JOIN qualifications q ON sr.qualification_id = q.id
    ORDER BY sr.created_at DESC
  `);
}

async function getPendingSupplements(supplier_id) {
  const db = getDb();
  let sql = `
    SELECT sr.*, s.name as supplier_name, q.name as qualification_name, q.expiry_date as original_expiry
    FROM supplement_requests sr
    JOIN suppliers s ON sr.supplier_id = s.id
    JOIN qualifications q ON sr.qualification_id = q.id
    WHERE sr.status = 'pending'
  `;
  const values = [];
  
  if (supplier_id) {
    sql += ' AND sr.supplier_id = ?';
    values.push(supplier_id);
  }
  sql += ' ORDER BY sr.created_at DESC';
  
  return db.all(sql, values);
}

async function submitSupplement(id, new_certificate_no, new_expiry_date, submitted_by) {
  const db = getDb();
  
  const supplement = await db.get('SELECT * FROM supplement_requests WHERE id = ?', [id]);
  if (!supplement) {
    throw new Error('补证申请不存在');
  }
  
  if (supplement.status !== 'pending') {
    throw new Error('补证申请已处理，无法重复提交');
  }
  
  if (!new_expiry_date) {
    throw new Error('必须提供新的到期日期');
  }
  
  await db.run(`
    UPDATE supplement_requests 
    SET status = 'submitted', 
        new_certificate_no = ?, 
        new_expiry_date = ?, 
        submitted_by = ?, 
        submitted_at = datetime('now'), 
        updated_at = datetime('now')
    WHERE id = ?
  `, [new_certificate_no, new_expiry_date, submitted_by, id]);
  
  await exceptionService.recordException({
    type: 'business_event',
    severity: 'low',
    supplier_id: supplement.supplier_id,
    qualification_id: supplement.qualification_id,
    error: '补证材料已提交',
    raw_data: { id, submitted_by, new_expiry_date }
  });
  
  return getSupplementById(id);
}

async function approveSupplement(id, approval_by) {
  const db = getDb();
  
  const supplement = await db.get('SELECT * FROM supplement_requests WHERE id = ?', [id]);
  if (!supplement) {
    await exceptionService.recordException({
      type: 'data_not_found',
      severity: 'medium',
      error: '补证申请不存在',
      raw_data: { id }
    });
    throw new Error('补证申请不存在');
  }
  
  if (supplement.status !== 'submitted') {
    await exceptionService.recordException({
      type: 'business_error',
      severity: 'medium',
      supplier_id: supplement.supplier_id,
      error: `补证申请状态不正确: ${supplement.status}`,
      raw_data: { id, supplement }
    });
    throw new Error(`补证申请状态为 ${supplement.status}，不能审批`);
  }
  
  if (!supplement.new_expiry_date) {
    throw new Error('补证申请未提交新的到期日期');
  }
  
  await qualificationService.updateQualificationStatus(
    supplement.qualification_id, 
    supplement.new_expiry_date,
    supplement.new_certificate_no
  );
  
  await db.run(`
    UPDATE supplement_requests 
    SET status = 'approved', 
        approved_by = ?, 
        approved_at = datetime('now'), 
        updated_at = datetime('now')
    WHERE id = ?
  `, [approval_by, id]);
  
  const statusCheck = await qualificationService.checkSupplierStatus(supplement.supplier_id);
  
  let unfrozen = false;
  if (statusCheck.expired_qualifications.length === 0 && 
      statusCheck.active_risks.length === 0) {
    const supplier = await qualificationService.getSupplierById(supplement.supplier_id);
    if (supplier.status === 'frozen') {
      await qualificationService.unfreezeSupplier(
        supplement.supplier_id, 
        `补证通过自动恢复: ${supplement.reason || '资质已更新'}`
      );
      unfrozen = true;
    }
  }
  
  await exceptionService.recordException({
    type: 'business_event',
    severity: 'low',
    supplier_id: supplement.supplier_id,
    qualification_id: supplement.qualification_id,
    error: '补证申请已批准',
    raw_data: { id, approval_by, unfrozen }
  });
  
  return {
    supplement: await getSupplementById(id),
    unfrozen
  };
}

async function rejectSupplement(id, reason, rejected_by) {
  const db = getDb();
  
  const supplement = await db.get('SELECT * FROM supplement_requests WHERE id = ?', [id]);
  if (!supplement) {
    throw new Error('补证申请不存在');
  }
  
  if (supplement.status !== 'submitted' && supplement.status !== 'pending') {
    throw new Error('补证申请已处理，无法重复审批');
  }
  
  await db.run(`
    UPDATE supplement_requests 
    SET status = 'rejected', 
        rejected_by = ?, 
        rejected_at = datetime('now'), 
        rejection_reason = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `, [rejected_by, reason || '未通过审批', id]);
  
  await exceptionService.recordException({
    type: 'business_event',
    severity: 'medium',
    supplier_id: supplement.supplier_id,
    qualification_id: supplement.qualification_id,
    error: `补证申请被拒绝: ${reason || '未提供原因'}`,
    raw_data: { id, rejected_by, reason }
  });
  
  return getSupplementById(id);
}

module.exports = {
  createSupplement,
  getSupplementById,
  getAllSupplements,
  getPendingSupplements,
  submitSupplement,
  approveSupplement,
  rejectSupplement
};
