const { v4: uuidv4 } = require('uuid');
const { run, get, all } = require('../config/database');
const {
  DuplicateSubmissionError,
  NotFoundError,
  StatusConflictError,
  ValidationError,
  BatchNotEmptyError
} = require('../utils/errors');
const { BATCH_STATUS, SPECIMEN_STATUS, validateTransition } = require('../utils/statusMachine');
const statusHistoryService = require('./statusHistoryService');

async function generateBatchNumber() {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  
  const maxNum = await get(
    `SELECT MAX(CAST(SUBSTR(batch_number, 9) AS INTEGER)) as max_num
     FROM batches
     WHERE batch_number LIKE ?`,
    [`BATCH-${dateStr}-%`]
  );

  const nextNum = (maxNum?.max_num || 0) + 1;
  return `BATCH-${dateStr}-${String(nextNum).padStart(4, '0')}`;
}

async function createBatch(data) {
  const {
    destination_lab,
    courier,
    scheduled_time
  } = data;

  if (!destination_lab || destination_lab.trim() === '') {
    throw new ValidationError('目标实验室不能为空', 'destination_lab', destination_lab);
  }

  const batchNumber = await generateBatchNumber();
  const id = uuidv4();
  const status = BATCH_STATUS.CREATED;

  await run(
    `INSERT INTO batches (id, batch_number, destination_lab, courier, scheduled_time, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, batchNumber, destination_lab, courier, scheduled_time, status]
  );

  await statusHistoryService.recordStatusChange('batch', id, null, status);

  return getBatchById(id);
}

async function getBatchById(id) {
  const batch = await get('SELECT * FROM batches WHERE id = ?', [id]);
  
  if (!batch) {
    return null;
  }

  const specimens = await all(
    `SELECT id, barcode, patient_name, specimen_type, status 
     FROM specimens 
     WHERE batch_id = ?
     ORDER BY created_at ASC`,
    [id]
  );

  const chainSegments = await all(
    `SELECT * FROM chain_segments 
     WHERE batch_id = ?
     ORDER BY start_time ASC`,
    [id]
  );

  return {
    ...batch,
    specimens,
    specimenCount: specimens.length,
    chainSegments
  };
}

async function getBatchByNumber(batchNumber) {
  const batch = await get('SELECT id FROM batches WHERE batch_number = ?', [batchNumber]);
  
  if (!batch) {
    throw new NotFoundError('批次号', batchNumber);
  }

  return getBatchById(batch.id);
}

async function getAllBatches(filters = {}) {
  let sql = `SELECT b.*, 
             (SELECT COUNT(*) FROM specimens WHERE batch_id = b.id) as specimen_count
             FROM batches b WHERE 1=1`;
  const params = [];

  if (filters.status) {
    sql += ' AND b.status = ?';
    params.push(filters.status);
  }
  if (filters.destination_lab) {
    sql += ' AND b.destination_lab = ?';
    params.push(filters.destination_lab);
  }

  sql += ' ORDER BY b.created_at DESC';

  return all(sql, params);
}

async function updateBatchStatus(batchId, newStatus, operator = null, reason = null) {
  const batch = await getBatchById(batchId);

  if (!batch) {
    throw new NotFoundError('批次', batchId);
  }

  const currentStatus = batch.status;

  if (currentStatus === newStatus) {
    return batch;
  }

  validateTransition('batch', currentStatus, newStatus);

  await run(
    'UPDATE batches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [newStatus, batchId]
  );

  await statusHistoryService.recordStatusChange('batch', batchId, currentStatus, newStatus, operator, reason);

  await syncSpecimensWithBatchStatus(batchId, newStatus, operator, reason);

  return getBatchById(batchId);
}

async function syncSpecimensWithBatchStatus(batchId, batchStatus, operator, reason) {
  let specimenStatus = null;

  switch (batchStatus) {
    case BATCH_STATUS.SHIPPED:
      specimenStatus = SPECIMEN_STATUS.SHIPPED;
      break;
    case BATCH_STATUS.IN_TRANSIT:
      specimenStatus = SPECIMEN_STATUS.IN_TRANSIT;
      break;
    case BATCH_STATUS.DELIVERED:
      specimenStatus = SPECIMEN_STATUS.DELIVERED;
      break;
    case BATCH_STATUS.REPORTED:
      specimenStatus = SPECIMEN_STATUS.REPORTED;
      break;
  }

  if (specimenStatus) {
    const specimens = await all('SELECT id FROM specimens WHERE batch_id = ?', [batchId]);
    
    for (const specimen of specimens) {
      await run(
        'UPDATE specimens SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [specimenStatus, specimen.id]
      );

      await statusHistoryService.recordStatusChange(
        'specimen',
        specimen.id,
        null,
        specimenStatus,
        operator,
        `批次状态变更: ${reason || batchStatus}`
      );
    }
  }
}

async function readyBatch(batchId, operator = null) {
  const batch = await getBatchById(batchId);
  if (!batch) {
    throw new NotFoundError('批次', batchId);
  }

  if (batch.specimenCount === 0) {
    throw new ValidationError('批次中没有标本，无法准备发货', 'specimens', []);
  }

  return updateBatchStatus(batchId, BATCH_STATUS.READY, operator, '批次已准备就绪');
}

async function shipBatch(batchId, operator = null) {
  return updateBatchStatus(batchId, BATCH_STATUS.SHIPPED, operator, '批次已发货');
}

async function startTransit(batchId, operator = null) {
  return updateBatchStatus(batchId, BATCH_STATUS.IN_TRANSIT, operator, '批次开始运输');
}

async function deliverBatch(batchId, operator = null) {
  await run(
    'UPDATE batches SET delivered_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [batchId]
  );

  return updateBatchStatus(batchId, BATCH_STATUS.DELIVERED, operator, '批次已送达');
}

async function markBatchReported(batchId, operator = null) {
  const specimens = await all('SELECT id, status FROM specimens WHERE batch_id = ?', [batchId]);
  
  const incompleteSpecimens = specimens.filter(
    s => s.status !== SPECIMEN_STATUS.REPORTED && s.status !== SPECIMEN_STATUS.COMPLETED
  );

  if (incompleteSpecimens.length > 0) {
    throw new StatusConflictError(
      '批次',
      batchId,
      null,
      [],
      `标记为已报告 (存在 ${incompleteSpecimens.length} 个未报告标本)`
    );
  }

  return updateBatchStatus(batchId, BATCH_STATUS.REPORTED, operator, '批次所有标本已报告');
}

async function deleteBatch(batchId) {
  const batch = await getBatchById(batchId);
  if (!batch) {
    throw new NotFoundError('批次', batchId);
  }

  if (batch.specimenCount > 0) {
    throw new BatchNotEmptyError(batchId, batch.specimenCount);
  }

  if (batch.status !== BATCH_STATUS.CREATED) {
    throw new StatusConflictError(
      '批次',
      batchId,
      batch.status,
      [BATCH_STATUS.CREATED],
      '删除批次'
    );
  }

  await run('DELETE FROM batches WHERE id = ?', [batchId]);
  return { success: true, batchId };
}

module.exports = {
  createBatch,
  getBatchById,
  getBatchByNumber,
  getAllBatches,
  updateBatchStatus,
  readyBatch,
  shipBatch,
  startTransit,
  deliverBatch,
  markBatchReported,
  deleteBatch
};
