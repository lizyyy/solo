const { getDb } = require('../database');
const { v4: uuidv4 } = require('uuid');
const qualificationService = require('./qualification-service');
const exceptionService = require('./exception-service');

async function createRecoveryRequest(params) {
  const db = getDb();
  const { supplier_id, reason } = params;
  
  if (!supplier_id) {
    await exceptionService.recordException({
      type: 'validation_error',
      severity: 'low',
      supplier_id,
      error: '恢复申请信息不完整',
      raw_data: params
    });
    throw new Error('供应商ID为必填项');
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
  
  if (supplier.status !== 'frozen') {
    throw new Error('供应商未被冻结，无需恢复');
  }
  
  const existing = await db.get(`
    SELECT * FROM recovery_requests 
    WHERE supplier_id = ? AND status = 'pending'
  `, [supplier_id]);
  
  if (existing) {
    throw new Error('该供应商已有待处理的恢复申请');
  }
  
  const id = 'rec_' + uuidv4().substring(0, 8);
  
  await db.run(`
    INSERT INTO recovery_requests (id, supplier_id, reason)
    VALUES (?, ?, ?)
  `, [id, supplier_id, reason]);
  
  await exceptionService.recordException({
    type: 'business_event',
    severity: 'low',
    supplier_id,
    error: '创建恢复申请',
    raw_data: params
  });
  
  return getRecoveryById(id);
}

async function getRecoveryById(id) {
  const db = getDb();
  return db.get(`
    SELECT rr.*, s.name as supplier_name, s.status as current_status
    FROM recovery_requests rr
    JOIN suppliers s ON rr.supplier_id = s.id
    WHERE rr.id = ?
  `, [id]);
}

async function getAllRecoveryRequests() {
  const db = getDb();
  return db.all(`
    SELECT rr.*, s.name as supplier_name, s.status as current_status
    FROM recovery_requests rr
    JOIN suppliers s ON rr.supplier_id = s.id
    ORDER BY rr.created_at DESC
  `);
}

async function getPendingRecoveryRequests() {
  const db = getDb();
  return db.all(`
    SELECT rr.*, s.name as supplier_name, s.status as current_status
    FROM recovery_requests rr
    JOIN suppliers s ON rr.supplier_id = s.id
    WHERE rr.status = 'pending'
    ORDER BY rr.created_at DESC
  `);
}

async function approveRecovery(id, approval_by) {
  const db = getDb();
  
  const recovery = await db.get('SELECT * FROM recovery_requests WHERE id = ?', [id]);
  if (!recovery) {
    await exceptionService.recordException({
      type: 'data_not_found',
      severity: 'medium',
      error: '恢复申请不存在',
      raw_data: { id }
    });
    throw new Error('恢复申请不存在');
  }
  
  if (recovery.status !== 'pending') {
    throw new Error('恢复申请已处理，无法重复审批');
  }
  
  const statusCheck = await qualificationService.checkSupplierStatus(recovery.supplier_id);
  
  if (statusCheck.expired_qualifications.length > 0) {
    const expiredList = statusCheck.expired_qualifications
      .map(q => `${q.type}(${q.name})`)
      .join('、');
    
    await exceptionService.recordException({
      type: 'business_error',
      severity: 'high',
      supplier_id: recovery.supplier_id,
      error: `无法恢复：存在过期资质 - ${expiredList}`,
      raw_data: { id, statusCheck }
    });
    
    throw new Error(`该供应商存在过期资质：${expiredList}，请先处理补证`);
  }
  
  if (statusCheck.active_risks.length > 0) {
    const riskList = statusCheck.active_risks
      .map(r => `${r.risk_type}`)
      .join('、');
    
    await exceptionService.recordException({
      type: 'business_error',
      severity: 'high',
      supplier_id: recovery.supplier_id,
      error: `无法恢复：存在活跃风险 - ${riskList}`,
      raw_data: { id, statusCheck }
    });
    
    throw new Error(`该供应商存在活跃风险：${riskList}，请先处理风险`);
  }
  
  await db.run(`
    UPDATE recovery_requests 
    SET status = 'approved', 
        approved_by = ?, 
        approved_at = datetime('now'), 
        updated_at = datetime('now')
    WHERE id = ?
  `, [approval_by, id]);
  
  await qualificationService.unfreezeSupplier(
    recovery.supplier_id,
    recovery.reason || '恢复申请审批通过'
  );
  
  await exceptionService.recordException({
    type: 'business_event',
    severity: 'low',
    supplier_id: recovery.supplier_id,
    error: '恢复申请已批准，供应商已解冻',
    raw_data: { id, approval_by }
  });
  
  return {
    recovery: await getRecoveryById(id),
    unfrozen: true
  };
}

async function rejectRecovery(id, reason, rejected_by) {
  const db = getDb();
  
  const recovery = await db.get('SELECT * FROM recovery_requests WHERE id = ?', [id]);
  if (!recovery) {
    throw new Error('恢复申请不存在');
  }
  
  if (recovery.status !== 'pending') {
    throw new Error('恢复申请已处理，无法重复审批');
  }
  
  await db.run(`
    UPDATE recovery_requests 
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
    supplier_id: recovery.supplier_id,
    error: `恢复申请被拒绝: ${reason || '未提供原因'}`,
    raw_data: { id, rejected_by, reason }
  });
  
  return getRecoveryById(id);
}

module.exports = {
  createRecoveryRequest,
  getRecoveryById,
  getAllRecoveryRequests,
  getPendingRecoveryRequests,
  approveRecovery,
  rejectRecovery
};
