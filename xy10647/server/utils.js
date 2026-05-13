const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const db = require('./database');
const crypto = require('crypto');

function generateId() {
  return uuidv4();
}

function formatDate(date) {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss');
}

function addTimeline(entityType, entityId, action, description, operator, details = {}) {
  return new Promise((resolve, reject) => {
    const id = generateId();
    db.run(
      `INSERT INTO timeline (id, entity_type, entity_id, action, description, operator, operation_time, details)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, entityType, entityId, action, description, operator, formatDate(), JSON.stringify(details)],
      (err) => {
        if (err) reject(err);
        else resolve(id);
      }
    );
  });
}

function addModificationHistory(entityType, entityId, fieldName, oldValue, newValue, operator, operationType, reason) {
  return new Promise((resolve, reject) => {
    const id = generateId();
    db.run(
      `INSERT INTO modification_history (id, entity_type, entity_id, field_name, old_value, new_value, operator, operation_type, reason, operation_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, entityType, entityId, fieldName, String(oldValue), String(newValue), operator, operationType, reason, formatDate()],
      (err) => {
        if (err) reject(err);
        else resolve(id);
      }
    );
  });
}

async function checkIdempotency(key, requestData) {
  return new Promise((resolve, reject) => {
    const requestHash = crypto.createHash('md5').update(JSON.stringify(requestData)).digest('hex');
    const expiresAt = dayjs().add(24, 'hour').format('YYYY-MM-DD HH:mm:ss');
    
    db.get(
      `SELECT * FROM idempotency_keys WHERE key = ?`,
      [key],
      (err, row) => {
        if (err) {
          reject(err);
        } else if (row) {
          if (row.request_hash === requestHash) {
            resolve({ exists: true, response: JSON.parse(row.response) });
          } else {
            reject(new Error('幂等键已存在但请求内容不匹配'));
          }
        } else {
          resolve({ exists: false, requestHash, expiresAt });
        }
      }
    );
  });
}

function saveIdempotencyResponse(key, requestHash, response, expiresAt) {
  return new Promise((resolve, reject) => {
    const id = generateId();
    db.run(
      `INSERT INTO idempotency_keys (id, key, request_hash, response, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, key, requestHash, JSON.stringify(response), expiresAt],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function idempotentMiddleware(req, res, next) {
  const idempotencyKey = req.headers['x-idempotency-key'];
  if (!idempotencyKey) {
    return next();
  }
  
  checkIdempotency(idempotencyKey, { body: req.body, params: req.params, query: req.query })
    .then(result => {
      if (result.exists) {
        return res.json(result.response);
      }
      req.idempotency = { key: idempotencyKey, requestHash: result.requestHash, expiresAt: result.expiresAt };
      const originalJson = res.json;
      res.json = function(data) {
        saveIdempotencyResponse(idempotencyKey, result.requestHash, data, result.expiresAt);
        return originalJson.call(this, data);
      };
      next();
    })
    .catch(err => {
      res.status(400).json({ error: err.message });
    });
}

function getTimeline(entityType, entityId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM timeline WHERE entity_type = ? AND entity_id = ? ORDER BY operation_time DESC`,
      [entityType, entityId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(row => ({
          ...row,
          details: row.details ? JSON.parse(row.details) : null
        })));
      }
    );
  });
}

function getModificationHistory(entityType, entityId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM modification_history WHERE entity_type = ? AND entity_id = ? ORDER BY operation_time DESC`,
      [entityType, entityId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

module.exports = {
  generateId,
  formatDate,
  addTimeline,
  addModificationHistory,
  checkIdempotency,
  saveIdempotencyResponse,
  idempotentMiddleware,
  getTimeline,
  getModificationHistory
};
