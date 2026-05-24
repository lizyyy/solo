const fs = require('fs');

const content = `const { runQuery, getQuery, allQuery } = require('../models/database');
const logService = require('./logService');

const BATCH_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  RETURNED: 'returned',
  WITHDRAWN: 'withdrawn'
};

async function createBatch({batchNo, sender, receiveDate, remark, handler}) {
  const existing = await getQuery('SELECT id FROM batches WHERE batch_no = ?', [batchNo]);
  if (existing) {
    throw new Error(\`Batch number \${batchNo} already exists\`);
  }

  const sql = \`INSERT INTO batches (batch_no, sender, receive_date, remark, status) 
    VALUES (?, ?, ?, ?, ?)\`;
  
  const result = await runQuery(sql, [batchNo, sender, receiveDate, remark, BATCH_STATUS.PENDING]);
  
  await logService.createLog({
    batchId: result.lastID,
    operationType: logService.OPERATION_TYPES.BATCH_CREATE,
    reason: 'Create new batch',
    handler,
    newStatus: BATCH_STATUS.PENDING,
    detail: \`Sender: \${sender}, Receive date: \${receiveDate}\`
  });

  return { id: result.lastID, batchNo };
}

async function getBatchById(id) {
  return getQuery('SELECT * FROM batches WHERE id = ?', [id]);
}

async function getAllBatches({ status, keyword } = {}) {
  let sql = 'SELECT * FROM batches WHERE 1=1';
  const params = [];

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (keyword) {
    sql += ' AND (batch_no LIKE ? OR sender LIKE ?)';
    params.push(\`\${keyword}%\`, \`%\${keyword}%\`);
  }

  sql += ' ORDER BY created_at DESC';
  return allQuery(sql, params);
}

async function updateBatchStatus(batchId, newStatus, { reason, handler, detail }) {
  const batch = await getBatchById(batchId);
  if (!batch) {
    throw new Error('Batch not found');
  }

  const oldStatus = batch.status;
  
  await runQuery(
    'UPDATE batches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [newStatus, batchId]
  );

  let operationType;
  switch (newStatus) {
    case BATCH_STATUS.COMPLETED:
      operationType = logService.OPERATION_TYPES.BATCH_PROCESS;
      break;
    case BATCH_STATUS.RETURNED:
      operationType = logService.OPERATION_TYPES.BATCH_RETURN;
      break;
    case BATCH_STATUS.WITHDRAWN:
      operationType = logService.OPERATION_TYPES.BATCH_WITHDRAW;
      break;
    default:
      operationType = logService.OPERATION_TYPES.REMARK;
  }

  await logService.createLog({
    batchId,
    operationType,
    reason: reason || 'Status updated',
    handler,
    oldStatus,
    newStatus,
    detail: detail || 'Batch status updated successfully'
  });
}

async function markBatchProcessed(batchId, { reason, handler }) {
  return updateBatchStatus(batchId, BATCH_STATUS.COMPLETED, {
    reason,
    handler,
    detail: 'All samples tested and completed'
  });
}

async function returnBatchForRevision(batchId, { reason, handler }) {
  return updateBatchStatus(batchId, BATCH_STATUS.RETURNED, {
    reason,
    handler,
    detail: 'Batch returned for revision'
  });
}

async function withdrawBatch(batchId, { reason, handler }) {
  return updateBatchStatus(batchId, BATCH_STATUS.WITHDRAWN, {
    reason,
    handler,
    detail: 'Batch withdrawn'
  });
}

function getStatusDescription(status) {
  const descriptions = {
    'pending': 'Pending',
    'processing': 'Processing',
    'completed': 'Completed',
    'returned': 'Returned',
    'withdrawn': 'Withdrawn'
  };
  return descriptions[status] || status;
}

module.exports = {
  BATCH_STATUS,
  createBatch,
  getBatchById,
  getAllBatches,
  updateBatchStatus,
  markBatchProcessed,
  returnBatchForRevision,
  withdrawBatch,
  getStatusDescription
};`;

fs.writeFileSync('src/services/batchService.js', content);
console.log('batchService.js written successfully');
