const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const db = require('../utils/database');

const STATUS_FLOW = {
  PENDING: ['REVIEWING', 'APPROVED', 'REJECTED', 'RETURNED', 'EXPIRED', 'CANCELLED'],
  REVIEWING: ['APPROVED', 'REJECTED', 'RETURNED'],
  APPROVED: ['DISPENSED', 'EXCHANGE_REQUESTED', 'CANCELLED'],
  REJECTED: ['RESUBMITTED', 'CANCELLED'],
  RETURNED: ['RESUBMITTED', 'CANCELLED'],
  DISPENSED: ['COMPLETED', 'EXCHANGE_REQUESTED'],
  EXCHANGE_REQUESTED: ['EXCHANGE_APPROVED', 'EXCHANGE_REJECTED'],
  EXCHANGE_APPROVED: ['DISPENSED', 'COMPLETED'],
  EXCHANGE_REJECTED: ['DISPENSED', 'COMPLETED'],
  RESUBMITTED: ['REVIEWING', 'APPROVED', 'REJECTED', 'RETURNED'],
  COMPLETED: [],
  EXPIRED: [],
  CANCELLED: []
};

const canTransition = (currentStatus, nextStatus) => {
  return STATUS_FLOW[currentStatus]?.includes(nextStatus) || false;
};

const isExpired = (expireDate) => {
  return moment().isAfter(moment(expireDate));
};

const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const createPrescription = async (data) => {
  const existing = await dbGet('SELECT id FROM prescriptions WHERE prescription_no = ?', [data.prescription_no]);
  if (existing) {
    return {
      success: true,
      idempotent: true,
      prescription_id: existing.id,
      message: '处方已存在，幂等返回'
    };
  }

  const prescriptionId = uuidv4();
  const expireDate = data.expire_date || moment(data.issue_date).add(3, 'days').toISOString();

  if (isExpired(expireDate)) {
    await recordException({
      prescription_id: prescriptionId,
      request_id: data.request_id || uuidv4(),
      api_path: '/api/prescriptions',
      original_input: JSON.stringify(data),
      error_type: 'PRESCRIPTION_EXPIRED',
      error_message: '处方已过期',
      processing_result: '拒绝接收'
    });
    throw new Error('处方已过期');
  }

  await dbRun(`
    INSERT INTO prescriptions (
      id, prescription_no, order_id, patient_name, patient_id_card,
      doctor_name, hospital_name, issue_date, expire_date, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    prescriptionId, data.prescription_no, data.order_id,
    data.patient_name, data.patient_id_card, data.doctor_name,
    data.hospital_name, data.issue_date, expireDate, 'PENDING'
  ]);

  if (data.medicines && data.medicines.length > 0) {
    for (const medicine of data.medicines) {
      await dbRun(`
        INSERT INTO prescription_medicines (
          id, prescription_id, medicine_name, specification,
          dosage, quantity, unit, price
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        uuidv4(), prescriptionId, medicine.medicine_name,
        medicine.specification, medicine.dosage, medicine.quantity,
        medicine.unit, medicine.price
      ]);
    }
  }

  await createAuditLog({
    prescription_id: prescriptionId,
    action: 'CREATE',
    new_status: 'PENDING',
    operator_id: data.operator_id,
    operator_name: data.operator_name,
    comment: '创建处方'
  });

  return {
    success: true,
    idempotent: false,
    prescription_id: prescriptionId
  };
};

const getPrescriptionById = async (id) => {
  const prescription = await dbGet('SELECT * FROM prescriptions WHERE id = ?', [id]);
  if (!prescription) return null;

  const medicines = await dbAll('SELECT * FROM prescription_medicines WHERE prescription_id = ?', [id]);
  const reviews = await dbAll('SELECT * FROM pharmacist_reviews WHERE prescription_id = ? ORDER BY review_time DESC', [id]);
  const returns = await dbAll('SELECT * FROM return_records WHERE prescription_id = ? ORDER BY created_at DESC', [id]);
  const exchanges = await dbAll('SELECT * FROM medicine_exchange WHERE prescription_id = ? ORDER BY created_at DESC', [id]);
  const auditLogs = await dbAll('SELECT * FROM audit_logs WHERE prescription_id = ? ORDER BY created_at DESC', [id]);

  return {
    ...prescription,
    medicines,
    reviews,
    returns,
    exchanges,
    audit_logs: auditLogs,
    is_expired: isExpired(prescription.expire_date)
  };
};

const getPrescriptionByNo = async (prescriptionNo) => {
  const prescription = await dbGet('SELECT id FROM prescriptions WHERE prescription_no = ?', [prescriptionNo]);
  if (!prescription) return null;
  return getPrescriptionById(prescription.id);
};

const updateStatus = async (prescriptionId, newStatus, data = {}) => {
  const prescription = await dbGet('SELECT * FROM prescriptions WHERE id = ?', [prescriptionId]);
  if (!prescription) {
    throw new Error('处方不存在');
  }

  if (!canTransition(prescription.status, newStatus)) {
    await recordException({
      prescription_id: prescriptionId,
      request_id: data.request_id || uuidv4(),
      api_path: `/api/prescriptions/${prescriptionId}/status`,
      original_input: JSON.stringify({ newStatus, ...data }),
      error_type: 'INVALID_STATUS_TRANSITION',
      error_message: `无法从 ${prescription.status} 转换到 ${newStatus}`,
      processing_result: '拒绝状态变更'
    });
    throw new Error(`无法从 ${prescription.status} 转换到 ${newStatus}`);
  }

  await dbRun('UPDATE prescriptions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, prescriptionId]);

  await createAuditLog({
    prescription_id: prescriptionId,
    action: 'STATUS_CHANGE',
    old_status: prescription.status,
    new_status: newStatus,
    operator_id: data.operator_id,
    operator_name: data.operator_name,
    comment: data.comment || `状态变更: ${prescription.status} -> ${newStatus}`
  });

  return getPrescriptionById(prescriptionId);
};

const addPharmacistReview = async (prescriptionId, reviewData) => {
  const reviewId = uuidv4();
  
  await dbRun(`
    INSERT INTO pharmacist_reviews (
      id, prescription_id, pharmacist_id, pharmacist_name, review_result, review_comment
    ) VALUES (?, ?, ?, ?, ?, ?)
  `, [
    reviewId, prescriptionId, reviewData.pharmacist_id,
    reviewData.pharmacist_name, reviewData.review_result,
    reviewData.review_comment
  ]);

  const nextStatus = reviewData.review_result === 'PASS' ? 'APPROVED' : 'REJECTED';
  return updateStatus(prescriptionId, nextStatus, {
    operator_id: reviewData.pharmacist_id,
    operator_name: reviewData.pharmacist_name,
    comment: `药师复核${reviewData.review_result === 'PASS' ? '通过' : '不通过'}`
  });
};

const addReturnRecord = async (prescriptionId, returnData) => {
  const returnId = uuidv4();
  
  await dbRun(`
    INSERT INTO return_records (
      id, prescription_id, return_reason, return_detail, operator_id, operator_name
    ) VALUES (?, ?, ?, ?, ?, ?)
  `, [
    returnId, prescriptionId, returnData.return_reason,
    returnData.return_detail, returnData.operator_id,
    returnData.operator_name
  ]);

  return updateStatus(prescriptionId, 'RETURNED', {
    operator_id: returnData.operator_id,
    operator_name: returnData.operator_name,
    comment: `退回原因: ${returnData.return_reason}`
  });
};

const createExchangeRequest = async (prescriptionId, exchangeData) => {
  const prescription = await dbGet('SELECT status FROM prescriptions WHERE id = ?', [prescriptionId]);
  if (!prescription) {
    throw new Error('处方不存在');
  }

  if (prescription.status !== 'APPROVED' && prescription.status !== 'DISPENSED') {
    await recordException({
      prescription_id: prescriptionId,
      request_id: exchangeData.request_id || uuidv4(),
      api_path: `/api/prescriptions/${prescriptionId}/exchange`,
      original_input: JSON.stringify(exchangeData),
      error_type: 'EXCHANGE_NOT_ALLOWED',
      error_message: '当前状态不允许申请换药',
      processing_result: '拒绝换药申请'
    });
    throw new Error('当前状态不允许申请换药');
  }

  const exchangeId = uuidv4();
  
  await dbRun(`
    INSERT INTO medicine_exchange (
      id, prescription_id, original_medicine_id, original_medicine_name,
      new_medicine_name, new_specification, new_dosage, new_quantity,
      exchange_reason, operator_id, operator_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    exchangeId, prescriptionId, exchangeData.original_medicine_id,
    exchangeData.original_medicine_name, exchangeData.new_medicine_name,
    exchangeData.new_specification, exchangeData.new_dosage,
    exchangeData.new_quantity, exchangeData.exchange_reason,
    exchangeData.operator_id, exchangeData.operator_name
  ]);

  return updateStatus(prescriptionId, 'EXCHANGE_REQUESTED', {
    operator_id: exchangeData.operator_id,
    operator_name: exchangeData.operator_name,
    comment: `申请换药: ${exchangeData.original_medicine_name} -> ${exchangeData.new_medicine_name}`
  });
};

const approveExchange = async (exchangeId, approvalData) => {
  const exchange = await dbGet('SELECT * FROM medicine_exchange WHERE id = ?', [exchangeId]);
  if (!exchange) {
    throw new Error('换药申请不存在');
  }

  if (exchange.status !== 'PENDING') {
    throw new Error('该换药申请已处理');
  }

  await dbRun(`
    UPDATE medicine_exchange 
    SET status = 'APPROVED', pharmacist_approval_id = ?, pharmacist_approval_name = ?, approval_time = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [approvalData.pharmacist_id, approvalData.pharmacist_name, exchangeId]);

  return updateStatus(exchange.prescription_id, 'EXCHANGE_APPROVED', {
    operator_id: approvalData.pharmacist_id,
    operator_name: approvalData.pharmacist_name,
    comment: '药师批准换药'
  });
};

const manualCorrection = async (prescriptionId, correctionData) => {
  const prescription = await dbGet('SELECT * FROM prescriptions WHERE id = ?', [prescriptionId]);
  if (!prescription) {
    throw new Error('处方不存在');
  }

  const updateFields = [];
  const params = [];

  if (correctionData.patient_name) {
    updateFields.push('patient_name = ?');
    params.push(correctionData.patient_name);
  }
  if (correctionData.patient_id_card) {
    updateFields.push('patient_id_card = ?');
    params.push(correctionData.patient_id_card);
  }
  if (correctionData.status) {
    updateFields.push('status = ?');
    params.push(correctionData.status);
  }

  if (updateFields.length > 0) {
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(prescriptionId);
    
    await dbRun(`UPDATE prescriptions SET ${updateFields.join(', ')} WHERE id = ?`, params);
  }

  await createAuditLog({
    prescription_id: prescriptionId,
    action: 'MANUAL_CORRECTION',
    old_status: prescription.status,
    new_status: correctionData.status || prescription.status,
    operator_id: correctionData.operator_id,
    operator_name: correctionData.operator_name,
    comment: correctionData.comment || '人工修正'
  });

  return getPrescriptionById(prescriptionId);
};

const recordException = async (exceptionData) => {
  try {
    await dbRun(`
      INSERT INTO exception_records (
        id, prescription_id, request_id, api_path, original_input,
        error_type, error_message, processing_result
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      uuidv4(), exceptionData.prescription_id, exceptionData.request_id,
      exceptionData.api_path, exceptionData.original_input,
      exceptionData.error_type, exceptionData.error_message,
      exceptionData.processing_result
    ]);
  } catch (err) {
    console.error('记录异常失败:', err);
  }
};

const createAuditLog = async (logData) => {
  try {
    await dbRun(`
      INSERT INTO audit_logs (
        id, prescription_id, action, old_status, new_status,
        operator_id, operator_name, comment
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      uuidv4(), logData.prescription_id, logData.action,
      logData.old_status, logData.new_status, logData.operator_id,
      logData.operator_name, logData.comment
    ]);
  } catch (err) {
    console.error('记录审计日志失败:', err);
  }
};

const searchPrescriptions = async (filters = {}) => {
  let sql = 'SELECT * FROM prescriptions WHERE 1=1';
  const params = [];

  if (filters.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters.prescription_no) {
    sql += ' AND prescription_no LIKE ?';
    params.push(`%${filters.prescription_no}%`);
  }
  if (filters.patient_name) {
    sql += ' AND patient_name LIKE ?';
    params.push(`%${filters.patient_name}%`);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(filters.limit || 20, filters.offset || 0);

  return dbAll(sql, params);
};

const generateRetentionReport = async (startDate, endDate) => {
  const prescriptions = await dbAll(`
    SELECT p.*, 
           COUNT(DISTINCT r.id) as review_count,
           COUNT(DISTINCT rt.id) as return_count,
           COUNT(DISTINCT e.id) as exchange_count
    FROM prescriptions p
    LEFT JOIN pharmacist_reviews r ON p.id = r.prescription_id
    LEFT JOIN return_records rt ON p.id = rt.prescription_id
    LEFT JOIN medicine_exchange e ON p.id = e.prescription_id
    WHERE p.created_at BETWEEN ? AND ?
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `, [startDate, endDate]);

  const summary = {
    total: prescriptions.length,
    by_status: {},
    expired: 0,
    reviewed: 0,
    returned: 0,
    exchanged: 0
  };

  for (const p of prescriptions) {
    summary.by_status[p.status] = (summary.by_status[p.status] || 0) + 1;
    if (isExpired(p.expire_date)) summary.expired++;
    if (p.review_count > 0) summary.reviewed++;
    if (p.return_count > 0) summary.returned++;
    if (p.exchange_count > 0) summary.exchanged++;
  }

  return {
    report_date: moment().toISOString(),
    period: { start: startDate, end: endDate },
    summary,
    prescriptions
  };
};

const getExceptions = async (handled = null) => {
  let sql = 'SELECT * FROM exception_records';
  const params = [];
  
  if (handled !== null) {
    sql += ' WHERE handled = ?';
    params.push(handled ? 1 : 0);
  }
  
  sql += ' ORDER BY created_at DESC';
  return dbAll(sql, params);
};

module.exports = {
  createPrescription,
  getPrescriptionById,
  getPrescriptionByNo,
  updateStatus,
  addPharmacistReview,
  addReturnRecord,
  createExchangeRequest,
  approveExchange,
  manualCorrection,
  recordException,
  searchPrescriptions,
  generateRetentionReport,
  getExceptions,
  canTransition,
  isExpired
};
