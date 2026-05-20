const { run, get, all } = require('../database/db');
const { logAction, ACTION_TYPES } = require('./auditService');

const generateBatchNo = () => {
  const date = new Date();
  const timestamp = date.getTime().toString().slice(-6);
  return `BATCH${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${timestamp}`;
};

const createBatch = async (batchData, handler) => {
  const batchNo = generateBatchNo();
  const sql = `
    INSERT INTO batches (batch_no, name, applicant, department, apply_date, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `;
  const result = await run(sql, [
    batchNo,
    batchData.name,
    batchData.applicant,
    batchData.department || null,
    batchData.apply_date
  ]);

  await logAction({
    batchId: result.id,
    actionType: ACTION_TYPES.BATCH_CREATED,
    actionReason: '创建新批次',
    handler,
    oldStatus: null,
    newStatus: 'pending'
  });

  return { id: result.id, batchNo };
};

const getBatchById = async (id) => {
  const sql = 'SELECT * FROM batches WHERE id = ?';
  return get(sql, [id]);
};

const getBatchByNo = async (batchNo) => {
  const sql = 'SELECT * FROM batches WHERE batch_no = ?';
  return get(sql, [batchNo]);
};

const getAllBatches = async () => {
  const sql = 'SELECT * FROM batches ORDER BY created_at DESC';
  return all(sql);
};

const updateBatchStatus = async (id, status, handler, reason = null) => {
  const batch = await getBatchById(id);
  if (!batch) {
    throw new Error('批次不存在');
  }

  const sql = 'UPDATE batches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
  await run(sql, [status, id]);

  let actionType;
  switch (status) {
    case 'approved':
      actionType = ACTION_TYPES.BATCH_APPROVED;
      break;
    case 'rejected':
      actionType = ACTION_TYPES.BATCH_REJECTED;
      break;
    case 'returned':
      actionType = ACTION_TYPES.BATCH_RETURNED;
      break;
    default:
      actionType = ACTION_TYPES.STATUS_CHANGED;
  }

  await logAction({
    batchId: id,
    actionType,
    actionReason: reason,
    handler,
    oldStatus: batch.status,
    newStatus: status
  });

  return { success: true, id, status };
};

const returnBatchForModification = async (id, handler, reason) => {
  return updateBatchStatus(id, 'returned', handler, reason);
};

module.exports = {
  createBatch,
  getBatchById,
  getBatchByNo,
  getAllBatches,
  updateBatchStatus,
  returnBatchForModification
};
