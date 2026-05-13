const db = require('./database');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

const addTimeline = async (entityType, entityId, action, description, operator = 'system', metadata = {}) => {
  await db.run(
    `INSERT INTO timeline (id, entity_type, entity_id, action, description, operator, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [uuidv4(), entityType, entityId, action, description, operator, JSON.stringify(metadata)]
  );
};

const checkIdempotency = async (key) => {
  const existing = await db.get(
    `SELECT * FROM reschedule_records WHERE idempotency_key = ?`,
    [key]
  );
  return existing;
};

const checkYieldLimit = async (batchId, newQuantity) => {
  const batch = await db.get(
    `SELECT * FROM orchard_batches WHERE id = ?`,
    [batchId]
  );
  
  if (!batch) {
    return { valid: false, reason: '批次不存在' };
  }

  const totalBooked = await db.get(
    `SELECT SUM(quantity) as total FROM appointments WHERE batch_id = ? AND status NOT IN ('cancelled', 'refunded')`,
    [batchId]
  );

  const currentTotal = (totalBooked.total || 0) + newQuantity;
  
  if (currentTotal > batch.remaining_yield) {
    await db.run(
      `INSERT INTO yield_limits (id, batch_id, limit_type, threshold, current_value, is_exceeded, alert_level) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), batchId, 'overbooking', batch.remaining_yield, currentTotal, 1, 'critical']
    );
    
    await addTimeline('yield_limit', batchId, 'yield_exceeded', 
      `产量限额超限: 当前预约${currentTotal}kg > 剩余产量${batch.remaining_yield}kg`);
    
    return { 
      valid: false, 
      reason: '产量限额超限', 
      details: { 
        remaining: batch.remaining_yield, 
        requested: newQuantity,
        currentTotal 
      } 
    };
  }

  return { valid: true };
};

const calculateRefund = async (appointmentId, cancelDate) => {
  const appointment = await db.get(
    `SELECT * FROM appointments WHERE id = ?`,
    [appointmentId]
  );
  
  if (!appointment) {
    return { rate: 0, amount: 0 };
  }

  const rules = await db.all(
    `SELECT * FROM refund_rules WHERE is_active = 1 ORDER BY days_before_appointment DESC`
  );

  const daysDiff = dayjs(appointment.appointment_date).diff(dayjs(cancelDate), 'day');
  
  let applicableRule = rules.find(r => daysDiff >= r.days_before_appointment) || { refund_rate: 0 };
  
  return {
    rate: applicableRule.refund_rate,
    days: daysDiff,
    ruleName: applicableRule.rule_name
  };
};

const processReschedule = async (data, operator = 'system') => {
  const { appointmentId, newDate, reason, idempotencyKey } = data;

  if (idempotencyKey) {
    const existing = await checkIdempotency(idempotencyKey);
    if (existing) {
      return {
        success: true,
        duplicate: true,
        record: existing,
        message: '重复请求，返回已有记录'
      };
    }
  }

  const appointment = await db.get(
    `SELECT * FROM appointments WHERE id = ?`,
    [appointmentId]
  );

  if (!appointment) {
    return { success: false, reason: '预约不存在', code: 'APPOINTMENT_NOT_FOUND' };
  }

  const batch = await db.get(
    `SELECT * FROM orchard_batches WHERE id = ?`,
    [appointment.batch_id]
  );

  const yieldCheck = await checkYieldLimit(appointment.batch_id, appointment.quantity);
  if (!yieldCheck.valid) {
    const recordId = uuidv4();
    await db.run(
      `INSERT INTO reschedule_records (id, appointment_id, original_date, new_date, reason, operator, status, idempotency_key, failure_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [recordId, appointmentId, appointment.appointment_date, newDate, reason, operator, 'failed', idempotencyKey, yieldCheck.reason]
    );
    
    await addTimeline('reschedule', recordId, 'failed', 
      `改期失败: ${yieldCheck.reason}`, operator);
    
    return { 
      success: false, 
      blocked: true,
      reason: yieldCheck.reason, 
      code: 'YIELD_LIMIT_EXCEEDED',
      details: yieldCheck.details
    };
  }

  const recordId = uuidv4();
  await db.run(
    `INSERT INTO reschedule_records (id, appointment_id, original_date, new_date, reason, operator, status, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [recordId, appointmentId, appointment.appointment_date, newDate, reason, operator, 'pending_review', idempotencyKey]
  );

  await db.run(
    `UPDATE appointments SET appointment_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [newDate, appointmentId]
  );

  await addTimeline('reschedule', recordId, 'submitted', 
    `改期申请已提交: ${appointment.appointment_date} → ${newDate}`, operator);

  await db.run(
    `INSERT INTO notifications (id, type, target_id, title, content, recipient) VALUES (?, ?, ?, ?, ?, ?)`,
    [uuidv4(), 'reschedule_review', recordId, '改期通知待复核', `客户${appointment.customer_name}申请改期，请复核`, 'admin']
  );

  return {
    success: true,
    recordId,
    status: 'pending_review',
    message: '改期申请已提交，待复核',
    requiresReview: true
  };
};

const reviewReschedule = async (recordId, approved, reviewedBy, notes = '') => {
  const record = await db.get(
    `SELECT * FROM reschedule_records WHERE id = ?`,
    [recordId]
  );

  if (!record) {
    return { success: false, reason: '记录不存在' };
  }

  const newStatus = approved ? 'approved' : 'rejected';
  
  await db.run(
    `UPDATE reschedule_records SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, review_notes = ? WHERE id = ?`,
    [newStatus, reviewedBy, notes, recordId]
  );

  await addTimeline('reschedule', recordId, 'reviewed', 
    `改期${approved ? '通过' : '拒绝'}: ${notes}`, reviewedBy);

  if (approved) {
    await db.run(
      `UPDATE appointments SET status = 'rescheduled', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [record.appointment_id]
    );
  }

  return { success: true, status: newStatus };
};

const manualCorrection = async (entityType, entityId, corrections, operator) => {
  let updateSql = '';
  let params = [];
  
  if (entityType === 'appointment') {
    updateSql = `UPDATE appointments SET `;
    const updates = [];
    if (corrections.quantity !== undefined) {
      updates.push('quantity = ?');
      params.push(corrections.quantity);
    }
    if (corrections.appointment_date !== undefined) {
      updates.push('appointment_date = ?');
      params.push(corrections.appointment_date);
    }
    if (corrections.status !== undefined) {
      updates.push('status = ?');
      params.push(corrections.status);
    }
    updateSql += updates.join(', ') + `, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    params.push(entityId);
  }

  if (params.length > 1) {
    await db.run(updateSql, params);
    await addTimeline(entityType, entityId, 'manual_correction', 
      `人工修正: ${JSON.stringify(corrections)}`, operator);
  }

  return { success: true };
};

module.exports = {
  checkIdempotency,
  checkYieldLimit,
  calculateRefund,
  processReschedule,
  reviewReschedule,
  manualCorrection,
  addTimeline
};
