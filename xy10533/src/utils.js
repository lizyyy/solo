const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { getDb } = require('./database');

const db = () => getDb();

const generateId = () => uuidv4();

const getCurrentTime = () => moment().format('YYYY-MM-DD HH:mm:ss');

const formatDate = (date) => moment(date).format('YYYY-MM-DD HH:mm:ss');

const isExpired = (expiryDate) => {
  return moment().isAfter(moment(expiryDate));
};

const isThawOvertime = (thawStartTime, expectedThawHours = 24) => {
  const startTime = moment(thawStartTime);
  const expectedEndTime = startTime.add(expectedThawHours, 'hours');
  return moment().isAfter(expectedEndTime);
};

const addStatusHistory = (entityType, entityId, fromStatus, toStatus, action, operator, reason = null, beforeData = null, afterData = null) => {
  return new Promise((resolve, reject) => {
    const id = generateId();
    const now = getCurrentTime();
    const database = db();
    
    database.run(
      `INSERT INTO status_history (id, entity_type, entity_id, from_status, to_status, action, operator, reason, before_data, after_data, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        entityType,
        entityId,
        fromStatus,
        toStatus,
        action,
        operator,
        reason,
        beforeData ? JSON.stringify(beforeData) : null,
        afterData ? JSON.stringify(afterData) : null,
        now
      ],
      (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(id);
        }
      }
    );
  });
};

const checkIdempotency = (operationType, key) => {
  return new Promise((resolve, reject) => {
    const database = db();
    database.get(
      `SELECT * FROM idempotency_records WHERE operation_type = ? AND key = ?`,
      [operationType, key],
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      }
    );
  });
};

const saveIdempotencyResult = (operationType, key, result) => {
  return new Promise((resolve, reject) => {
    const id = generateId();
    const now = getCurrentTime();
    const database = db();
    
    database.run(
      `INSERT INTO idempotency_records (id, operation_type, key, result, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, operationType, key, JSON.stringify(result), now],
      (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(id);
        }
      }
    );
  });
};

const getStatusHistory = (entityType, entityId) => {
  return new Promise((resolve, reject) => {
    const database = db();
    database.all(
      `SELECT * FROM status_history WHERE entity_type = ? AND entity_id = ? ORDER BY created_at ASC`,
      [entityType, entityId],
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const history = rows.map(row => ({
            ...row,
            before_data: row.before_data ? JSON.parse(row.before_data) : null,
            after_data: row.after_data ? JSON.parse(row.after_data) : null
          }));
          resolve(history);
        }
      }
    );
  });
};

module.exports = {
  generateId,
  getCurrentTime,
  formatDate,
  isExpired,
  isThawOvertime,
  addStatusHistory,
  checkIdempotency,
  saveIdempotencyResult,
  getStatusHistory
};
