const { runQuery, getOne, getAll } = require('../database');
const { generateNo } = require('../utils/generator');
const { updateExceptionStatus, createProcessingLog } = require('./exceptionService');

async function createReassignment(exceptionRecordId, fromRiderId, reason, rawInput = null) {
  const reassignmentNo = generateNo('REA');
  
  const result = await runQuery(
    `INSERT INTO reassignment_records (reassignment_no, exception_record_id, from_rider_id, reason, status)
     VALUES (?, ?, ?, ?, 'pending')`,
    [reassignmentNo, exceptionRecordId, fromRiderId, reason]
  );
  
  await updateExceptionStatus(
    exceptionRecordId,
    'reassignment_pending',
    'system',
    rawInput,
    '改派申请已提交'
  );
  
  return getReassignmentById(result.id);
}

async function getReassignmentById(id) {
  return getOne(
    `SELECT rr.*, r1.name as from_rider_name, r2.name as to_rider_name
     FROM reassignment_records rr
     LEFT JOIN riders r1 ON rr.from_rider_id = r1.id
     LEFT JOIN riders r2 ON rr.to_rider_id = r2.id
     WHERE rr.id = ?`,
    [id]
  );
}

async function processReassignment(reassignmentId, toRiderId, status, processedBy, conclusion, rawInput = null) {
  const reassignment = await getReassignmentById(reassignmentId);
  if (!reassignment) {
    throw new Error('改派记录不存在');
  }
  
  await runQuery(
    `UPDATE reassignment_records 
     SET to_rider_id = ?, status = ?, processed_time = CURRENT_TIMESTAMP, processed_by = ?, conclusion = ?
     WHERE id = ?`,
    [toRiderId, status, processedBy, conclusion, reassignmentId]
  );
  
  let exceptionStatus;
  if (status === 'approved') {
    exceptionStatus = 'reassigned';
  } else if (status === 'rejected') {
    exceptionStatus = 'reassignment_rejected';
  } else {
    exceptionStatus = 'processing';
  }
  
  await updateExceptionStatus(
    reassignment.exception_record_id,
    exceptionStatus,
    processedBy,
    rawInput,
    conclusion
  );
  
  return getReassignmentById(reassignmentId);
}

async function queryReassignments(params = {}) {
  let sql = `SELECT rr.*, r1.name as from_rider_name, r2.name as to_rider_name
             FROM reassignment_records rr
             LEFT JOIN riders r1 ON rr.from_rider_id = r1.id
             LEFT JOIN riders r2 ON rr.to_rider_id = r2.id
             WHERE 1=1`;
  const values = [];
  
  if (params.exceptionRecordId) {
    sql += ` AND rr.exception_record_id = ?`;
    values.push(params.exceptionRecordId);
  }
  if (params.status) {
    sql += ` AND rr.status = ?`;
    values.push(params.status);
  }
  
  sql += ` ORDER BY rr.requested_time DESC`;
  
  return getAll(sql, values);
}

module.exports = {
  createReassignment,
  getReassignmentById,
  processReassignment,
  queryReassignments
};
