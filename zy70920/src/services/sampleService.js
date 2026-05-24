const { runQuery, getQuery, allQuery } = require('../models/database');
const logService = require('./logService');

const SAMPLE_STATUS = {
  PENDING: 'pending',
  TESTING: 'testing',
  PASSED: 'passed',
  FAILED: 'failed',
  RECHECKING: 'rechecking',
  MIXED: 'mixed'
};

async function createSample({ sampleNo, batchId, sampleName, sampleType, quantity, unit, package, handler }) {
  const existing = await getQuery('SELECT id FROM samples WHERE sample_no = ?', [sampleNo]);
  if (existing) {
    throw new Error('Sample number ' + sampleNo + ' already exists');
  }

  const sql = 'INSERT INTO samples (sample_no, batch_id, sample_name, sample_type, quantity, unit, package, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
  
  return runQuery(sql, [sampleNo, batchId, sampleName, sampleType, quantity, unit, package, SAMPLE_STATUS.PENDING]);
}

async function getSampleById(id) {
  return getQuery('SELECT * FROM samples WHERE id = ?', [id]);
}

async function getSamplesByBatch(batchId) {
  return allQuery('SELECT * FROM samples WHERE batch_id = ? ORDER BY created_at DESC', [batchId]);
}

async function searchSamples({ sampleNo, sampleName, status, recheckResult, itemPackage } = {}) {
  let sql = 'SELECT s.*, b.batch_no, b.sender FROM samples s LEFT JOIN batches b on b.id = s.batch_id WHERE 1=1';
  const params = [];

  if (sampleNo) {
    sql += ' AND s.sample_no LIKE ?';
    params.push('%' + sampleNo + '%');
  }
  if (sampleName) {
    sql += ' AND s.sample_name LIKE ?';
    params.push('%' + sampleName + '%');
  }
  if (status) {
    sql += ' AND s.status = ?';
    params.push(status);
  }
  if (recheckResult) {
    sql += ' AND s.recheck_result = ?';
    params.push(recheckResult);
  }
  if (itemPackage) {
    sql += ' AND EXISTS (SELECT 1 FROM sample_test_items sti JOIN test_items ti on sti.test_item_id = ti.id WHERE sti.sample_id = s.id AND ti.item_package LIKE ?)';
    params.push('%' + itemPackage + '%');
  }

  sql += ' ORDER BY s.created_at DESC';
  return allQuery(sql, params);
}

async function markSampleMixed(sampleId, { reason, handler, relatedSamples }) {
  await runQuery('UPDATE samples SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [SAMPLE_STATUS.MIXED, sampleId]);

  const detail = 'Sample marked as mixed. Related samples: ' + (relatedSamples || 'None');
  
  await logService.createLog({
    sampleId,
    operationType: logService.OPERATION_TYPES.SAMPLE_MIXED,
    reason: reason || 'Sample mixed status',
    handler,
    newStatus: SAMPLE_STATUS.MIXED,
    detail
  });

  return { sampleId, status: SAMPLE_STATUS.MIXED };
}

async function requestRecheck(sampleId, { reason, handler, ruleCode }) {
  const sample = await getSampleById(sampleId);
  if (!sample) {
    throw new Error('Sample not found');
  }

  const oldStatus = sample.status;
  const detail = 'Recheck requested. Reason: ' + reason + '. Trigger rule: ' + (ruleCode || 'Manual request');
  
  await logService.createLog({
    sampleId,
    operationType: logService.OPERATION_TYPES.RECHECK_REQUEST,
    reason,
    handler,
    oldStatus,
    newStatus: SAMPLE_STATUS.RECHECKING,
    detail
  });

  await runQuery('UPDATE samples SET status = ?, recheck_count = recheck_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [SAMPLE_STATUS.RECHECKING, sampleId]);

  return { sampleId, status: SAMPLE_STATUS.RECHECKING };
}

async function setRecheckResult(sampleId, { result, handler, detail }) {
  const resultStatus = result === 'passed' ? SAMPLE_STATUS.PASSED : SAMPLE_STATUS.FAILED;
  
  await runQuery('UPDATE samples SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [resultStatus, sampleId]);
  
  await runQuery('UPDATE samples SET recheck_result = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [result, sampleId]);

  await logService.createLog({
    sampleId,
    operationType: logService.OPERATION_TYPES.RECHECK_RESULT,
    reason: detail || 'Recheck completed',
    handler,
    newStatus: resultStatus,
    detail: detail || ('Recheck result: ' + (result === 'passed' ? 'Passed' : 'Failed'))
  });

  return { sampleId, recheckResult: result };
}

function getStatusDescription(status) {
  const descriptions = {
    'pending': 'Pending',
    'testing': 'Testing',
    'passed': 'Passed',
    'failed': 'Failed',
    'rechecking': 'Rechecking',
    'mixed': 'Mixed'
  };
  return descriptions[status] || status;
}

module.exports = {
  SAMPLE_STATUS,
  createSample,
  getSampleById,
  getSamplesByBatch,
  searchSamples,
  markSampleMixed,
  requestRecheck,
  setRecheckResult,
  getStatusDescription
};
    'pending': 'Pending',
    'testing': 'Testing',
    'passed': 'Passed',
    'failed': 'Failed',
    'rechecking': 'Rechecking',
    'mixed': 'Mixed'
  };
  return descriptions[status] || status;
}

module.exports = {
  SAMPLE_STATUS,
  createSample,
  getSampleById,
  getSamplesByBatch,
  searchSamples,
  markSampleMixed,
  requestRecheck,
  setRecheckResult,
  getStatusDescription
};
