const { runQuery, getOne, getAll } = require('../database');
const { generateNo } = require('../utils/generator');
const { updateExceptionStatus, getExceptionRecordById, createProcessingLog } = require('./exceptionService');

async function createArbitration(exceptionRecordId, arbitrator, result, conclusion, penaltyType = null, penaltyAmount = null, rawInput = null) {
  const existingArbitrations = await getAll(
    `SELECT * FROM arbitration_results WHERE exception_record_id = ?`,
    [exceptionRecordId]
  );
  
  if (existingArbitrations.length > 0) {
    const lastArbitration = existingArbitrations[0];
    if (lastArbitration.is_appealable === 0) {
      throw new Error('该异常单已完成最终仲裁，不可重复仲裁');
    }
  }
  
  const arbitrationNo = generateNo('ARB');
  
  const appealDeadline = new Date();
  appealDeadline.setDate(appealDeadline.getDate() + 3);
  
  const resultData = await runQuery(
    `INSERT INTO arbitration_results 
     (arbitration_no, exception_record_id, arbitrator, result, conclusion, penalty_type, penalty_amount, appeal_deadline, raw_input)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      arbitrationNo,
      exceptionRecordId,
      arbitrator,
      result,
      conclusion,
      penaltyType,
      penaltyAmount,
      appealDeadline.toISOString(),
      rawInput ? JSON.stringify(rawInput) : null
    ]
  );
  
  let exceptionStatus;
  if (result === 'sustained') {
    exceptionStatus = 'arbitration_sustained';
  } else if (result === 'dismissed') {
    exceptionStatus = 'arbitration_dismissed';
  } else {
    exceptionStatus = 'arbitrated';
  }
  
  await updateExceptionStatus(
    exceptionRecordId,
    exceptionStatus,
    arbitrator,
    rawInput,
    conclusion
  );
  
  return getArbitrationById(resultData.id);
}

async function getArbitrationById(id) {
  return getOne(
    `SELECT * FROM arbitration_results WHERE id = ?`,
    [id]
  );
}

async function finalizeArbitration(arbitrationId, arbitrator, rawInput = null) {
  const arbitration = await getArbitrationById(arbitrationId);
  if (!arbitration) {
    throw new Error('仲裁记录不存在');
  }
  
  await runQuery(
    `UPDATE arbitration_results 
     SET is_appealable = 0
     WHERE id = ?`,
    [arbitrationId]
  );
  
  await updateExceptionStatus(
    arbitration.exception_record_id,
    'closed',
    arbitrator,
    rawInput,
    '仲裁结果已生效，异常单关闭'
  );
  
  return getArbitrationById(arbitrationId);
}

async function queryArbitrations(params = {}) {
  let sql = `SELECT * FROM arbitration_results WHERE 1=1`;
  const values = [];
  
  if (params.exceptionRecordId) {
    sql += ` AND exception_record_id = ?`;
    values.push(params.exceptionRecordId);
  }
  if (params.result) {
    sql += ` AND result = ?`;
    values.push(params.result);
  }
  
  sql += ` ORDER BY arbitration_time DESC`;
  
  return getAll(sql, values);
}

async function manualCorrection(exceptionRecordId, operator, correctionReason, newStatus, rawInput = null) {
  const exception = await getExceptionRecordById(exceptionRecordId);
  if (!exception) {
    throw new Error('异常单不存在');
  }
  
  const oldStatus = exception.status;
  
  await runQuery(
    `UPDATE exception_records 
     SET status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [newStatus, exceptionRecordId]
  );
  
  await createProcessingLog(
    exceptionRecordId,
    'manual_correction',
    operator,
    oldStatus,
    newStatus,
    rawInput,
    `人工修正：${correctionReason}`
  );
  
  return getExceptionRecordById(exceptionRecordId);
}

module.exports = {
  createArbitration,
  getArbitrationById,
  finalizeArbitration,
  queryArbitrations,
  manualCorrection
};
