const { runAsync, getAsync, allAsync } = require('../db');
const { v4: uuidv4 } = require('uuid');
const { CHANGE_STATUSES } = require('../constants/statuses');
const { detectAllConflicts, updateChangeConflicts } = require('./businessRules');

async function createFeedingChange(changeData) {
  const now = new Date().toISOString();
  const changeId = uuidv4();

  const changeRecord = {
    id: changeId,
    foster_order_id: changeData.foster_order_id,
    change_type: changeData.change_type,
    change_reason: changeData.change_reason,
    original_food_brand: changeData.original_food_brand,
    original_food_type: changeData.original_food_type,
    original_daily_amount: changeData.original_daily_amount,
    new_food_brand: changeData.new_food_brand,
    new_food_type: changeData.new_food_type,
    new_daily_amount: changeData.new_daily_amount,
    feeding_time_adjustment: changeData.feeding_time_adjustment,
    status: CHANGE_STATUSES.PENDING_REVIEW,
    submit_source: changeData.submit_source,
    submitted_by: changeData.submitted_by,
    submitted_at: now,
    created_at: now,
    updated_at: now
  };

  await runAsync('BEGIN TRANSACTION');

  try {
    await runAsync(`
      INSERT INTO feeding_changes (
        id, foster_order_id, change_type, change_reason,
        original_food_brand, original_food_type, original_daily_amount,
        new_food_brand, new_food_type, new_daily_amount, feeding_time_adjustment,
        status, submit_source, submitted_by, submitted_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      changeRecord.id,
      changeRecord.foster_order_id,
      changeRecord.change_type,
      changeRecord.change_reason,
      changeRecord.original_food_brand,
      changeRecord.original_food_type,
      changeRecord.original_daily_amount,
      changeRecord.new_food_brand,
      changeRecord.new_food_type,
      changeRecord.new_daily_amount,
      changeRecord.feeding_time_adjustment,
      changeRecord.status,
      changeRecord.submit_source,
      changeRecord.submitted_by,
      changeRecord.submitted_at,
      changeRecord.created_at,
      changeRecord.updated_at
    ]);

    const conflictDetection = await detectAllConflicts(changeData);
    await updateChangeConflicts(changeId, conflictDetection);

    await runAsync('COMMIT');

    return {
      ...changeRecord,
      conflictDetection,
      recordType: conflictDetection.hasConflict ? 'abnormal' : 'normal'
    };
  } catch (error) {
    await runAsync('ROLLBACK');
    throw error;
  }
}

async function getFeedingChangeById(id) {
  return await getAsync('SELECT * FROM feeding_changes WHERE id = ?', [id]);
}

async function getFeedingChanges(params = {}) {
  let query = 'SELECT * FROM feeding_changes WHERE 1=1';
  const queryParams = [];

  if (params.status) {
    query += ' AND status = ?';
    queryParams.push(params.status);
  }

  if (params.is_abnormal !== undefined) {
    query += ' AND is_abnormal = ?';
    queryParams.push(params.is_abnormal ? 1 : 0);
  }

  if (params.foster_order_id) {
    query += ' AND foster_order_id = ?';
    queryParams.push(params.foster_order_id);
  }

  if (params.change_type) {
    query += ' AND change_type = ?';
    queryParams.push(params.change_type);
  }

  query += ' ORDER BY created_at DESC';

  return await allAsync(query, queryParams);
}

async function getStatusLogs(changeId) {
  return await allAsync(`
    SELECT * FROM change_status_logs 
    WHERE feeding_change_id = ? 
    ORDER BY created_at ASC
  `, [changeId]);
}

async function getNormalRecords() {
  return await getFeedingChanges({ is_abnormal: false });
}

async function getAbnormalRecords() {
  return await getFeedingChanges({ is_abnormal: true });
}

module.exports = {
  createFeedingChange,
  getFeedingChangeById,
  getFeedingChanges,
  getStatusLogs,
  getNormalRecords,
  getAbnormalRecords
};
