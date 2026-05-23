const { runQuery, getOne, getAll, beginTransaction, commit, rollback } = require('../database');
const { generateNo } = require('../utils/generator');

async function createExceptionRecord(orderId, riderId, exceptionTypeId, description, rawInput = null) {
  const exceptionNo = generateNo('EXC');
  
  const result = await runQuery(
    `INSERT INTO exception_records (exception_no, order_id, rider_id, exception_type_id, description, status, raw_input)
     VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
    [exceptionNo, orderId, riderId, exceptionTypeId, description, rawInput ? JSON.stringify(rawInput) : null]
  );
  
  await createProcessingLog(
    result.id,
    'create_exception',
    'system',
    null,
    'pending',
    rawInput,
    '异常单创建成功'
  );
  
  return getExceptionRecordById(result.id);
}

async function getExceptionRecordById(id) {
  return getOne(
    `SELECT er.*, o.order_no, r.name as rider_name, et.name as exception_type_name, et.category as exception_category
     FROM exception_records er
     LEFT JOIN orders o ON er.order_id = o.id
     LEFT JOIN riders r ON er.rider_id = r.id
     LEFT JOIN exception_types et ON er.exception_type_id = et.id
     WHERE er.id = ?`,
    [id]
  );
}

async function getExceptionRecordByNo(exceptionNo) {
  return getOne(
    `SELECT er.*, o.order_no, r.name as rider_name, et.name as exception_type_name, et.category as exception_category
     FROM exception_records er
     LEFT JOIN orders o ON er.order_id = o.id
     LEFT JOIN riders r ON er.rider_id = r.id
     LEFT JOIN exception_types et ON er.exception_type_id = et.id
     WHERE er.exception_no = ?`,
    [exceptionNo]
  );
}

async function queryExceptionRecords(params = {}) {
  let sql = `SELECT er.*, o.order_no, r.name as rider_name, et.name as exception_type_name, et.category as exception_category
             FROM exception_records er
             LEFT JOIN orders o ON er.order_id = o.id
             LEFT JOIN riders r ON er.rider_id = r.id
             LEFT JOIN exception_types et ON er.exception_type_id = et.id
             WHERE 1=1`;
  const values = [];
  
  if (params.status) {
    sql += ` AND er.status = ?`;
    values.push(params.status);
  }
  if (params.riderId) {
    sql += ` AND er.rider_id = ?`;
    values.push(params.riderId);
  }
  if (params.exceptionCategory) {
    sql += ` AND et.category = ?`;
    values.push(params.exceptionCategory);
  }
  if (params.startTime) {
    sql += ` AND er.reported_time >= ?`;
    values.push(params.startTime);
  }
  if (params.endTime) {
    sql += ` AND er.reported_time <= ?`;
    values.push(params.endTime);
  }
  
  sql += ` ORDER BY er.reported_time DESC`;
  
  if (params.limit) {
    sql += ` LIMIT ?`;
    values.push(params.limit);
  }
  
  return getAll(sql, values);
}

async function getExceptionDetail(exceptionId) {
  const exception = await getExceptionRecordById(exceptionId);
  if (!exception) {
    return null;
  }
  
  const reassignments = await getAll(
    `SELECT rr.*, r1.name as from_rider_name, r2.name as to_rider_name
     FROM reassignment_records rr
     LEFT JOIN riders r1 ON rr.from_rider_id = r1.id
     LEFT JOIN riders r2 ON rr.to_rider_id = r2.id
     WHERE rr.exception_record_id = ?
     ORDER BY rr.requested_time DESC`,
    [exceptionId]
  );
  
  const evidences = await getAll(
    `SELECT ae.*, r.name as uploader_name
     FROM appeal_evidences ae
     LEFT JOIN riders r ON ae.uploader_id = r.id
     WHERE ae.exception_record_id = ?
     ORDER BY ae.upload_time DESC`,
    [exceptionId]
  );
  
  const arbitrations = await getAll(
    `SELECT * FROM arbitration_results
     WHERE exception_record_id = ?
     ORDER BY arbitration_time DESC`,
    [exceptionId]
  );
  
  const logs = await getAll(
    `SELECT * FROM processing_logs
     WHERE exception_record_id = ?
     ORDER BY operation_time DESC`,
    [exceptionId]
  );
  
  return {
    exception,
    reassignments,
    evidences,
    arbitrations,
    logs
  };
}

async function updateExceptionStatus(exceptionId, newStatus, operator, rawInput = null, conclusion = null) {
  const exception = await getExceptionRecordById(exceptionId);
  if (!exception) {
    throw new Error('异常单不存在');
  }
  
  const oldStatus = exception.status;
  
  await runQuery(
    `UPDATE exception_records SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [newStatus, exceptionId]
  );
  
  await createProcessingLog(
    exceptionId,
    'status_update',
    operator,
    oldStatus,
    newStatus,
    rawInput,
    conclusion || `状态从 ${oldStatus} 更新为 ${newStatus}`
  );
  
  return getExceptionRecordById(exceptionId);
}

async function createProcessingLog(exceptionRecordId, operationType, operator, beforeStatus, afterStatus, rawInput, conclusion) {
  const logNo = generateNo('LOG');
  
  return runQuery(
    `INSERT INTO processing_logs (log_no, exception_record_id, operation_type, operator, before_status, after_status, raw_input, conclusion)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      logNo,
      exceptionRecordId,
      operationType,
      operator,
      beforeStatus,
      afterStatus,
      rawInput ? JSON.stringify(rawInput) : null,
      conclusion
    ]
  );
}

module.exports = {
  createExceptionRecord,
  getExceptionRecordById,
  getExceptionRecordByNo,
  queryExceptionRecords,
  getExceptionDetail,
  updateExceptionStatus,
  createProcessingLog
};
