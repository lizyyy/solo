const { v4: uuidv4 } = require('uuid');
const { run, get, all } = require('../config/database');
const { ACTIVITY_STATUS, isValidStatusTransition, now } = require('../utils/status');
const { checkIdempotency, logOperation } = require('../utils/idempotency');

const createActivity = async (data, requestId = null, operator = 'system') => {
  const {
    storeId,
    storeName,
    activityName,
    activityDate,
    productName,
    description
  } = data;

  const idempotencyCheck = await checkIdempotency('activity', 'CREATE', requestId);
  if (idempotencyCheck.isDuplicate) {
    const existing = await getActivityById(JSON.parse(idempotencyCheck.existingLog.details).id);
    return {
      success: true,
      isDuplicate: true,
      message: '检测到重复请求，返回已创建的活动',
      data: existing
    };
  }

  const id = uuidv4();
  const sql = `INSERT INTO activities 
               (id, store_id, store_name, activity_name, activity_date, product_name, description, status, created_at, updated_at, created_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  await run(sql, [
    id,
    storeId,
    storeName,
    activityName,
    activityDate,
    productName,
    description || null,
    ACTIVITY_STATUS.DRAFT,
    now(),
    now(),
    operator
  ]);

  await logOperation('activity', id, 'CREATE', requestId, operator, null, ACTIVITY_STATUS.DRAFT, { id, ...data });

  const activity = await getActivityById(id);
  return {
    success: true,
    isDuplicate: false,
    data: activity
  };
};

const getActivityById = async (id) => {
  const sql = `SELECT * FROM activities WHERE id = ?`;
  return await get(sql, [id]);
};

const getActivities = async (filters = {}) => {
  let sql = `SELECT * FROM activities WHERE 1=1`;
  const params = [];

  if (filters.storeId) {
    sql += ' AND store_id = ?';
    params.push(filters.storeId);
  }
  if (filters.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters.activityDateFrom) {
    sql += ' AND activity_date >= ?';
    params.push(filters.activityDateFrom);
  }
  if (filters.activityDateTo) {
    sql += ' AND activity_date <= ?';
    params.push(filters.activityDateTo);
  }

  sql += ' ORDER BY created_at DESC';

  return await all(sql, params);
};

const advanceActivityStatus = async (id, targetStatus, requestId = null, operator = 'system') => {
  const activity = await getActivityById(id);
  if (!activity) {
    return { success: false, error: '活动不存在', code: 'NOT_FOUND' };
  }

  if (!Object.values(ACTIVITY_STATUS).includes(targetStatus)) {
    return { success: false, error: '无效的目标状态', code: 'INVALID_STATUS' };
  }

  const idempotencyCheck = await checkIdempotency('activity', 'ADVANCE_STATUS', requestId, id);
  if (idempotencyCheck.isDuplicate) {
    const updated = await getActivityById(id);
    return {
      success: true,
      isDuplicate: true,
      message: '检测到重复推进请求，当前状态已更新',
      data: updated
    };
  }

  if (!isValidStatusTransition('activities', activity.status, targetStatus)) {
    return {
      success: false,
      error: `状态流转不允许: ${activity.status} -> ${targetStatus}`,
      code: 'INVALID_TRANSITION'
    };
  }

  const sql = `UPDATE activities SET status = ?, updated_at = ? WHERE id = ?`;
  await run(sql, [targetStatus, now(), id]);

  await logOperation('activity', id, 'ADVANCE_STATUS', requestId, operator, activity.status, targetStatus);

  const updated = await getActivityById(id);
  return {
    success: true,
    isDuplicate: false,
    data: updated
  };
};

const cancelActivity = async (id, requestId = null, operator = 'system') => {
  return await advanceActivityStatus(id, ACTIVITY_STATUS.CANCELLED, requestId, operator);
};

const updateActivity = async (id, data, requestId = null, operator = 'system') => {
  const activity = await getActivityById(id);
  if (!activity) {
    return { success: false, error: '活动不存在', code: 'NOT_FOUND' };
  }

  if (activity.status === ACTIVITY_STATUS.CANCELLED || activity.status === ACTIVITY_STATUS.COMPLETED) {
    return {
      success: false,
      error: '已取消或已完成的活动无法修改',
      code: 'READONLY_STATUS'
    };
  }

  const allowedFields = ['activity_name', 'activity_date', 'product_name', 'description'];
  const updates = [];
  const params = [];

  const fieldMapping = {
    activityName: 'activity_name',
    activityDate: 'activity_date',
    productName: 'product_name',
    description: 'description'
  };

  for (const [key, dbField] of Object.entries(fieldMapping)) {
    if (data[key] !== undefined) {
      updates.push(`${dbField} = ?`);
      params.push(data[key]);
    }
  }

  if (updates.length === 0) {
    return { success: true, data: activity, message: '无需要更新的字段' };
  }

  const idempotencyCheck = await checkIdempotency('activity', 'UPDATE', requestId, id);
  if (idempotencyCheck.isDuplicate) {
    const updated = await getActivityById(id);
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

  const sql = `UPDATE activities SET ${updates.join(', ')} WHERE id = ?`;
  await run(sql, params);

  await logOperation('activity', id, 'UPDATE', requestId, operator, null, null, data);

  const updated = await getActivityById(id);
  return {
    success: true,
    isDuplicate: false,
    data: updated
  };
};

const getActivitySummary = async (id) => {
  const activity = await getActivityById(id);
  if (!activity) {
    return { success: false, error: '活动不存在', code: 'NOT_FOUND' };
  }

  const batches = await all(`SELECT * FROM batches WHERE activity_id = ?`, [id]);
  const samples = await all(`SELECT * FROM sample_archives WHERE activity_id = ?`, [id]);
  const complaints = await all(`SELECT * FROM complaints WHERE activity_id = ?`, [id]);

  return {
    success: true,
    data: {
      activity,
      batchCount: batches.length,
      batches,
      sampleCount: samples.length,
      samples,
      complaintCount: complaints.length,
      complaints
    }
  };
};

module.exports = {
  createActivity,
  getActivityById,
  getActivities,
  advanceActivityStatus,
  cancelActivity,
  updateActivity,
  getActivitySummary,
  ACTIVITY_STATUS
};
