const { runQuery, allQuery } = require('../models/database');

const OPERATION_TYPES = {
  BATCH_CREATE: 'batch_create',
  BATCH_PROCESS: 'batch_process',
  BATCH_RETURN: 'batch_return',
  BATCH_WITHDRAW: 'batch_withdraw',
  SAMPLE_MIXED: 'sample_mixed',
  RECHECK_REQUEST: 'recheck_request',
  RECHECK_RESULT: 'recheck_result',
  REPORT_WITHDRAW: 'report_withdraw',
  EXPORT: 'export',
  REMARK: 'remark'
};

async function createLog({ batchId, sampleId, operationType, reason, handler, oldStatus, newStatus, detail }) {
  const sql = `INSERT INTO operation_logs 
    (batch_id, sample_id, operation_type, reason, handler, old_status, new_status, detail)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  
  return runQuery(sql, [batchId, sampleId, operationType, reason, handler, oldStatus, newStatus, detail]);
}

async function getLogsByBatch(batchId) {
  const sql = `SELECT * FROM operation_logs WHERE batch_id = ? ORDER BY operation_time DESC`;
  return allQuery(sql, [batchId]);
}

async function getLogsBySample(sampleId) {
  const sql = `SELECT * FROM operation_logs WHERE sample_id = ? ORDER BY operation_time DESC`;
  return allQuery(sql, [sampleId]);
}

function getOperationDescription(type) {
  const descriptions = {
    'batch_create': 'Batch created',
    'batch_process': 'Batch processed',
    'batch_return': 'Batch returned',
    'batch_withdraw': 'Batch withdrawn',
    'sample_mixed': 'Sample marked mixed',
    'recheck_request': 'Recheck requested',
    'recheck_result': 'Recheck result',
    'report_withdraw': 'Report withdrawn',
    'export': 'Export data',
    'remark': 'Add remark'
  };
  return descriptions[type] || type;
}

module.exports = {
  OPERATION_TYPES,
  createLog,
  getLogsByBatch,
  getLogsBySample,
  getOperationDescription
};
