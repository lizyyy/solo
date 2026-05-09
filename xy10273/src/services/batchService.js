const { v4: uuidv4 } = require('uuid');
const { run, get, all } = require('../config/database');
const { SAMPLE_STATUS, isValidStatusTransition, calculateDestroyDeadline, now } = require('../utils/status');
const { checkIdempotency, logOperation } = require('../utils/idempotency');
const { getActivityById, ACTIVITY_STATUS } = require('./activityService');

const createBatch = async (activityId, data, requestId = null, operator = 'system') => {
  const activity = await getActivityById(activityId);
  if (!activity) {
    return { success: false, error: '活动不存在', code: 'NOT_FOUND' };
  }

  if (activity.status === ACTIVITY_STATUS.CANCELLED) {
    return { success: false, error: '已取消的活动无法添加批次', code: 'CANCELLED_ACTIVITY' };
  }

  const { batchNumber, productionDate, expirationDate, quantity } = data;

  const idempotencyCheck = await checkIdempotency('batch', 'CREATE', requestId, activityId);
  if (idempotencyCheck.isDuplicate) {
    const existingBatches = await getBatchesByActivity(activityId);
    return {
      success: true,
      isDuplicate: true,
      message: '检测到重复请求',
      data: existingBatches
    };
  }

  const id = uuidv4();
  const sql = `INSERT INTO batches 
               (id, activity_id, batch_number, production_date, expiration_date, quantity, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`;

  await run(sql, [
    id,
    activityId,
    batchNumber,
    productionDate,
    expirationDate,
    quantity,
    now()
  ]);

  await logOperation('batch', id, 'CREATE', requestId, operator, null, null, { activityId, ...data });

  const batch = await getBatchById(id);
  return {
    success: true,
    isDuplicate: false,
    data: batch
  };
};

const getBatchById = async (id) => {
  const sql = `SELECT * FROM batches WHERE id = ?`;
  return await get(sql, [id]);
};

const getBatchesByActivity = async (activityId) => {
  const sql = `SELECT * FROM batches WHERE activity_id = ? ORDER BY created_at DESC`;
  return await all(sql, [activityId]);
};

const createSampleArchive = async (data, requestId = null, operator = 'system') => {
  const { activityId, batchId, sampleQuantity, storageLocation, archiveDate, shelfLifeDays } = data;

  const activity = await getActivityById(activityId);
  if (!activity) {
    return { success: false, error: '活动不存在', code: 'NOT_FOUND' };
  }

  const batch = await getBatchById(batchId);
  if (!batch) {
    return { success: false, error: '批次不存在', code: 'NOT_FOUND' };
  }

  if (batch.activity_id !== activityId) {
    return { success: false, error: '批次不属于该活动', code: 'BATCH_MISMATCH' };
  }

  if (sampleQuantity > batch.quantity) {
    return { success: false, error: '留样数量不能超过批次总数量', code: 'QUANTITY_EXCEEDED' };
  }

  const idempotencyCheck = await checkIdempotency('sample_archive', 'CREATE', requestId, activityId);
  if (idempotencyCheck.isDuplicate) {
    const existingSamples = await getSamplesByActivity(activityId);
    return {
      success: true,
      isDuplicate: true,
      message: '检测到重复请求',
      data: existingSamples
    };
  }

  const destroyDeadline = calculateDestroyDeadline(archiveDate, shelfLifeDays || 7);

  const id = uuidv4();
  const sql = `INSERT INTO sample_archives 
               (id, activity_id, batch_id, sample_quantity, storage_location, archive_date, destroy_deadline, status, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  await run(sql, [
    id,
    activityId,
    batchId,
    sampleQuantity,
    storageLocation,
    archiveDate,
    destroyDeadline,
    SAMPLE_STATUS.ARCHIVED,
    now(),
    now()
  ]);

  await logOperation('sample_archive', id, 'CREATE', requestId, operator, null, SAMPLE_STATUS.ARCHIVED, { 
    ...data, 
    destroyDeadline 
  });

  const sample = await getSampleById(id);
  return {
    success: true,
    isDuplicate: false,
    data: sample
  };
};

const getSampleById = async (id) => {
  const sql = `SELECT sa.*, b.batch_number, b.production_date, b.expiration_date
               FROM sample_archives sa
               LEFT JOIN batches b ON sa.batch_id = b.id
               WHERE sa.id = ?`;
  return await get(sql, [id]);
};

const getSamplesByActivity = async (activityId) => {
  const sql = `SELECT sa.*, b.batch_number, b.production_date, b.expiration_date
               FROM sample_archives sa
               LEFT JOIN batches b ON sa.batch_id = b.id
               WHERE sa.activity_id = ? ORDER BY sa.created_at DESC`;
  return await all(sql, [activityId]);
};

const getSamplesForDestroyReminder = async (targetDate) => {
  const sql = `SELECT sa.*, a.store_name, a.activity_name, b.batch_number
               FROM sample_archives sa
               LEFT JOIN activities a ON sa.activity_id = a.id
               LEFT JOIN batches b ON sa.batch_id = b.id
               WHERE sa.status = ? AND sa.destroy_deadline <= ?
               ORDER BY sa.destroy_deadline ASC`;
  return await all(sql, [SAMPLE_STATUS.ARCHIVED, targetDate]);
};

const advanceSampleStatus = async (id, targetStatus, requestId = null, operator = 'system', extraData = {}) => {
  const sample = await getSampleById(id);
  if (!sample) {
    return { success: false, error: '留样记录不存在', code: 'NOT_FOUND' };
  }

  if (!Object.values(SAMPLE_STATUS).includes(targetStatus)) {
    return { success: false, error: '无效的目标状态', code: 'INVALID_STATUS' };
  }

  const idempotencyCheck = await checkIdempotency('sample_archive', 'ADVANCE_STATUS', requestId, id);
  if (idempotencyCheck.isDuplicate) {
    const updated = await getSampleById(id);
    return {
      success: true,
      isDuplicate: true,
      message: '检测到重复推进请求',
      data: updated
    };
  }

  if (!isValidStatusTransition('samples', sample.status, targetStatus)) {
    return {
      success: false,
      error: `状态流转不允许: ${sample.status} -> ${targetStatus}`,
      code: 'INVALID_TRANSITION'
    };
  }

  let sql;
  let params;

  if (targetStatus === SAMPLE_STATUS.DESTROYED) {
    sql = `UPDATE sample_archives SET status = ?, destroyed_at = ?, updated_at = ? WHERE id = ?`;
    params = [targetStatus, now(), now(), id];
  } else {
    sql = `UPDATE sample_archives SET status = ?, updated_at = ? WHERE id = ?`;
    params = [targetStatus, now(), id];
  }

  await run(sql, params);
  await logOperation('sample_archive', id, 'ADVANCE_STATUS', requestId, operator, sample.status, targetStatus, extraData);

  const updated = await getSampleById(id);
  return {
    success: true,
    isDuplicate: false,
    data: updated
  };
};

const destroySample = async (id, requestId = null, operator = 'system') => {
  return await advanceSampleStatus(id, SAMPLE_STATUS.DESTROYED, requestId, operator);
};

const retainSampleForInvestigation = async (id, requestId = null, operator = 'system', reason = '') => {
  return await advanceSampleStatus(id, SAMPLE_STATUS.RETAINED_FOR_INVESTIGATION, requestId, operator, { reason });
};

const updateSampleArchive = async (id, data, requestId = null, operator = 'system') => {
  const sample = await getSampleById(id);
  if (!sample) {
    return { success: false, error: '留样记录不存在', code: 'NOT_FOUND' };
  }

  if (sample.status === SAMPLE_STATUS.DESTROYED) {
    return { success: false, error: '已销毁的留样无法修改', code: 'READONLY_STATUS' };
  }

  const allowedFields = ['storage_location', 'sample_quantity'];
  const fieldMapping = {
    storageLocation: 'storage_location',
    sampleQuantity: 'sample_quantity'
  };

  const updates = [];
  const params = [];

  for (const [key, dbField] of Object.entries(fieldMapping)) {
    if (data[key] !== undefined) {
      updates.push(`${dbField} = ?`);
      params.push(data[key]);
    }
  }

  if (updates.length === 0) {
    return { success: true, data: sample, message: '无需要更新的字段' };
  }

  const idempotencyCheck = await checkIdempotency('sample_archive', 'UPDATE', requestId, id);
  if (idempotencyCheck.isDuplicate) {
    const updated = await getSampleById(id);
    return {
      success: true,
      isDuplicate: true,
      message: '检测到重复修改请求',
      data: updated
    };
  }

  updates.push('updated_at = ?');
  params.push(now());
  params.push(id);

  const sql = `UPDATE sample_archives SET ${updates.join(', ')} WHERE id = ?`;
  await run(sql, params);
  await logOperation('sample_archive', id, 'UPDATE', requestId, operator, null, null, data);

  const updated = await getSampleById(id);
  return {
    success: true,
    isDuplicate: false,
    data: updated
  };
};

const withdrawSampleArchive = async (id, requestId = null, operator = 'system', reason = '') => {
  const sample = await getSampleById(id);
  if (!sample) {
    return { success: false, error: '留样记录不存在', code: 'NOT_FOUND' };
  }

  if (sample.status === SAMPLE_STATUS.DESTROYED) {
    return { success: false, error: '已销毁的留样无法撤回', code: 'READONLY_STATUS' };
  }

  if (sample.status !== SAMPLE_STATUS.ARCHIVED) {
    return { success: false, error: '仅已留样状态可以撤回', code: 'INVALID_STATUS' };
  }

  const idempotencyCheck = await checkIdempotency('sample_archive', 'WITHDRAW', requestId, id);
  if (idempotencyCheck.isDuplicate) {
    return {
      success: true,
      isDuplicate: true,
      message: '检测到重复撤回请求'
    };
  }

  const sql = `DELETE FROM sample_archives WHERE id = ?`;
  await run(sql, [id]);
  await logOperation('sample_archive', id, 'WITHDRAW', requestId, operator, sample.status, null, { reason });

  return {
    success: true,
    isDuplicate: false,
    message: '留样记录已撤回'
  };
};

module.exports = {
  createBatch,
  getBatchById,
  getBatchesByActivity,
  createSampleArchive,
  getSampleById,
  getSamplesByActivity,
  getSamplesForDestroyReminder,
  advanceSampleStatus,
  destroySample,
  retainSampleForInvestigation,
  updateSampleArchive,
  withdrawSampleArchive,
  SAMPLE_STATUS
};
