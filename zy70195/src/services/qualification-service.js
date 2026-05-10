const { getDb } = require('../database');
const { v4: uuidv4 } = require('uuid');
const { differenceInDays, parseISO, isBefore, isAfter, addDays } = require('date-fns');
const exceptionService = require('./exception-service');

async function createSupplier(name) {
  const db = getDb();
  const id = 'sup_' + uuidv4().substring(0, 8);
  
  if (!name || name.trim() === '') {
    await exceptionService.recordException({
      type: 'validation_error',
      severity: 'low',
      error: '供应商名称为空',
      raw_data: { name }
    });
    throw new Error('供应商名称不能为空');
  }
  
  await db.run('INSERT INTO suppliers (id, name, status) VALUES (?, ?, ?)', [id, name.trim(), 'active']);
  
  return getSupplierById(id);
}

async function getSupplierById(id) {
  const db = getDb();
  return db.get('SELECT * FROM suppliers WHERE id = ?', [id]);
}

async function getAllSuppliers() {
  const db = getDb();
  return db.all('SELECT * FROM suppliers ORDER BY created_at DESC');
}

async function createQualification(params) {
  const db = getDb();
  const { supplier_id, type, name, certificate_no, effective_date, expiry_date } = params;
  
  if (!supplier_id || !type || !name || !effective_date || !expiry_date) {
    await exceptionService.recordException({
      type: 'validation_error',
      severity: 'medium',
      supplier_id,
      error: '资质信息不完整',
      raw_data: params
    });
    throw new Error('供应商ID、类型、名称、生效日期和到期日期为必填项');
  }
  
  const supplier = await getSupplierById(supplier_id);
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
  
  const id = 'qual_' + uuidv4().substring(0, 8);
  
  const now = new Date();
  const expiryDate = parseISO(expiry_date);
  let status = 'active';
  
  if (isBefore(expiryDate, now)) {
    status = 'expired';
  }
  
  await db.run(`
    INSERT INTO qualifications (
      id, supplier_id, type, name, certificate_no, 
      effective_date, expiry_date, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, supplier_id, type, name, certificate_no, effective_date, expiry_date, status]);
  
  return getQualificationById(id);
}

async function getQualificationById(id) {
  const db = getDb();
  return db.get('SELECT * FROM qualifications WHERE id = ?', [id]);
}

async function getQualificationsBySupplier(supplier_id) {
  const db = getDb();
  return db.all('SELECT * FROM qualifications WHERE supplier_id = ? ORDER BY expiry_date DESC', [supplier_id]);
}

async function getAllQualifications() {
  const db = getDb();
  return db.all('SELECT * FROM qualifications ORDER BY created_at DESC');
}

async function checkSupplierStatus(supplier_id) {
  const db = getDb();
  
  const supplier = await getSupplierById(supplier_id);
  if (!supplier) {
    return {
      can_order: false,
      status: 'not_found',
      reason: '供应商不存在',
      reasons: ['供应商不存在'],
      expired_qualifications: [],
      active_risks: [],
      pending_recoveries: []
    };
  }
  
  const expiredQuals = await db.all(`
    SELECT q.*, er.warning_days, er.freeze_days
    FROM qualifications q
    LEFT JOIN expiry_rules er ON q.type = er.qualification_type
    WHERE q.supplier_id = ? AND q.status = 'expired'
  `, [supplier_id]);
  
  const activeRisks = await db.all(`
    SELECT * FROM risk_list 
    WHERE supplier_id = ? AND status = 'active'
  `, [supplier_id]);
  
  const pendingRecoveries = await db.all(`
    SELECT * FROM recovery_requests
    WHERE supplier_id = ? AND status = 'pending'
  `, [supplier_id]);
  
  const reasons = [];
  
  if (supplier.status === 'frozen') {
    reasons.push('供应商已被冻结');
  }
  
  if (expiredQuals.length > 0) {
    reasons.push(`存在 ${expiredQuals.length} 个已过期的资质`);
  }
  
  if (activeRisks.length > 0) {
    reasons.push(`存在 ${activeRisks.length} 条未处理的风险记录`);
  }
  
  const can_order = reasons.length === 0;
  
  return {
    can_order,
    status: can_order ? 'active' : supplier.status,
    reason: reasons.length > 0 ? reasons[0] : '供应商状态正常',
    reasons,
    expired_qualifications: expiredQuals,
    active_risks: activeRisks,
    pending_recoveries: pendingRecoveries
  };
}

async function triggerSupplementInternal(db, qualification) {
  const existing = await db.get(`
    SELECT * FROM supplement_requests 
    WHERE qualification_id = ? AND status IN ('pending', 'submitted')
  `, [qualification.id]);
  
  if (existing) {
    await exceptionService.recordException({
      type: 'business_warning',
      severity: 'low',
      supplier_id: qualification.supplier_id,
      qualification_id: qualification.id,
      error: '已存在待处理的补证申请',
      raw_data: qualification
    });
    return existing;
  }
  
  const id = 'supp_' + uuidv4().substring(0, 8);
  
  await db.run(`
    INSERT INTO supplement_requests (id, supplier_id, qualification_id, reason)
    VALUES (?, ?, ?, ?)
  `, [id, qualification.supplier_id, qualification.id, `${qualification.type}过期需补证`]);
  
  await exceptionService.recordException({
    type: 'business_event',
    severity: 'low',
    supplier_id: qualification.supplier_id,
    qualification_id: qualification.id,
    error: '创建补证申请',
    raw_data: { qualification }
  });
  
  return db.get('SELECT * FROM supplement_requests WHERE id = ?', [id]);
}

async function detectExpiryQualifications() {
  const db = getDb();
  const now = new Date();
  const results = {
    expired: [],
    warning: [],
    needs_supplement: []
  };
  
  const rules = await db.all('SELECT * FROM expiry_rules WHERE is_active = 1');
  const ruleMap = new Map();
  rules.forEach(r => ruleMap.set(r.qualification_type, r));
  
  const qualifications = await db.all(`
    SELECT q.*, s.name as supplier_name, s.status as supplier_status
    FROM qualifications q
    JOIN suppliers s ON q.supplier_id = s.id
    WHERE q.status = 'active'
  `);
  
  for (const q of qualifications) {
    const expiryDate = parseISO(q.expiry_date);
    const daysToExpiry = differenceInDays(expiryDate, now);
    const rule = ruleMap.get(q.type);
    
    if (isBefore(expiryDate, now)) {
      await db.run(`
        UPDATE qualifications SET status = 'expired', updated_at = datetime('now')
        WHERE id = ?
      `, [q.id]);
      
      results.expired.push({
        id: q.id,
        supplier_id: q.supplier_id,
        supplier_name: q.supplier_name,
        qualification_name: q.name,
        expiry_date: q.expiry_date,
        days_overdue: Math.abs(daysToExpiry)
      });
      
      await freezeSupplier(q.supplier_id, `资质过期: ${q.name}`, q.id);
      await triggerSupplementInternal(db, q);
      
      await exceptionService.recordException({
        type: 'qualification_expiry',
        severity: 'high',
        supplier_id: q.supplier_id,
        qualification_id: q.id,
        error: `资质 ${q.name} 已过期`,
        raw_data: q
      });
    } else if (rule && daysToExpiry <= rule.warning_days) {
      results.warning.push({
        id: q.id,
        supplier_id: q.supplier_id,
        supplier_name: q.supplier_name,
        qualification_name: q.name,
        expiry_date: q.expiry_date,
        days_to_expiry: daysToExpiry,
        warning_days: rule.warning_days
      });
      
      if (daysToExpiry <= rule.warning_days / 2) {
        results.needs_supplement.push({
          id: q.id,
          supplier_id: q.supplier_id,
          qualification_name: q.name,
          days_to_expiry: daysToExpiry
        });
      }
    }
  }
  
  return results;
}

async function freezeSupplier(supplier_id, reason, qualification_id) {
  const db = getDb();
  
  const supplier = await getSupplierById(supplier_id);
  if (!supplier) return null;
  
  await db.run(`
    UPDATE suppliers SET status = 'frozen', updated_at = datetime('now')
    WHERE id = ?
  `, [supplier_id]);
  
  const logId = 'log_' + uuidv4().substring(0, 8);
  await db.run(`
    INSERT INTO freeze_logs (id, supplier_id, action, reason, qualification_id)
    VALUES (?, ?, 'freeze', ?, ?)
  `, [logId, supplier_id, reason, qualification_id]);
  
  await db.run(`
    UPDATE orders SET status = 'frozen', freeze_reason = ?, updated_at = datetime('now')
    WHERE supplier_id = ? AND status = 'pending'
  `, [reason, supplier_id]);
  
  await exceptionService.recordException({
    type: 'supplier_frozen',
    severity: 'high',
    supplier_id,
    qualification_id,
    error: `供应商被冻结: ${reason}`,
    raw_data: { supplier_id, reason, qualification_id }
  });
  
  return getSupplierById(supplier_id);
}

async function unfreezeSupplier(supplier_id, reason) {
  const db = getDb();
  
  await db.run(`
    UPDATE suppliers SET status = 'active', updated_at = datetime('now')
    WHERE id = ?
  `, [supplier_id]);
  
  const logId = 'log_' + uuidv4().substring(0, 8);
  await db.run(`
    INSERT INTO freeze_logs (id, supplier_id, action, reason)
    VALUES (?, ?, 'unfreeze', ?)
  `, [logId, supplier_id, reason]);
  
  await db.run(`
    UPDATE orders SET status = 'pending', freeze_reason = NULL, updated_at = datetime('now')
    WHERE supplier_id = ? AND status = 'frozen'
  `, [supplier_id]);
  
  await exceptionService.recordException({
    type: 'supplier_unfrozen',
    severity: 'low',
    supplier_id,
    error: `供应商已解冻: ${reason}`,
    raw_data: { supplier_id, reason }
  });
  
  return getSupplierById(supplier_id);
}

async function updateQualificationStatus(id, new_expiry_date, new_certificate_no) {
  const db = getDb();
  
  if (!new_expiry_date) {
    throw new Error('新的到期日期不能为空');
  }
  
  const qual = await getQualificationById(id);
  if (!qual) {
    await exceptionService.recordException({
      type: 'data_not_found',
      severity: 'medium',
      qualification_id: id,
      error: '资质记录不存在'
    });
    throw new Error('资质记录不存在');
  }
  
  const newExpiryDate = parseISO(new_expiry_date);
  const now = new Date();
  
  let status = 'active';
  if (isBefore(newExpiryDate, now)) {
    status = 'expired';
  }
  
  const updateSql = new_certificate_no 
    ? `UPDATE qualifications SET expiry_date = ?, certificate_no = ?, status = ?, updated_at = datetime('now') WHERE id = ?`
    : `UPDATE qualifications SET expiry_date = ?, status = ?, updated_at = datetime('now') WHERE id = ?`;
  
  const params = new_certificate_no 
    ? [new_expiry_date, new_certificate_no, status, id]
    : [new_expiry_date, status, id];
  
  await db.run(updateSql, params);
  
  if (status === 'active' && qual.status === 'expired') {
    const expiredQuals = await db.get(`
      SELECT COUNT(*) as count FROM qualifications 
      WHERE supplier_id = ? AND status = 'expired'
    `, [qual.supplier_id]);
    
    const activeRisks = await db.get(`
      SELECT COUNT(*) as count FROM risk_list 
      WHERE supplier_id = ? AND status = 'active'
    `, [qual.supplier_id]);
    
    if (expiredQuals.count === 0 && activeRisks.count === 0) {
      await unfreezeSupplier(qual.supplier_id, `资质更新: ${qual.name}`);
    }
  }
  
  return getQualificationById(id);
}

async function getFreezeLogs(supplier_id) {
  const db = getDb();
  return db.all(`
    SELECT * FROM freeze_logs 
    WHERE supplier_id = ? 
    ORDER BY created_at DESC
  `, [supplier_id]);
}

module.exports = {
  createSupplier,
  getSupplierById,
  getAllSuppliers,
  createQualification,
  getQualificationById,
  getQualificationsBySupplier,
  getAllQualifications,
  checkSupplierStatus,
  detectExpiryQualifications,
  freezeSupplier,
  unfreezeSupplier,
  updateQualificationStatus,
  getFreezeLogs
};
