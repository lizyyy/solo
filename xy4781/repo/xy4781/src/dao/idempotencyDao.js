const { runSql, getOne } = require('../database/connection');

const getIdempotencyKey = (idempotencyKey) => {
  const row = getOne('SELECT * FROM idempotency_keys WHERE idempotency_key = ?', [idempotencyKey]);
  if (row && row.response_data) {
    row.response_data = JSON.parse(row.response_data);
  }
  return row;
};

const createIdempotencyKey = (data) => {
  const { idempotencyKey, actionType, resourceId, responseData, expiresAt } = data;
  const responseDataJson = responseData ? JSON.stringify(responseData) : null;
  
  const existing = getIdempotencyKey(idempotencyKey);
  if (existing) {
    return null;
  }
  
  try {
    return runSql(`
      INSERT INTO idempotency_keys (idempotency_key, action_type, resource_id, response_data, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `, [idempotencyKey, actionType, resourceId, responseDataJson, expiresAt]);
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE constraint')) {
      return null;
    }
    throw e;
  }
};

const updateIdempotencyResponse = (idempotencyKey, resourceId, responseData) => {
  const responseDataJson = responseData ? JSON.stringify(responseData) : null;
  return runSql(`
    UPDATE idempotency_keys SET resource_id = ?, response_data = ? WHERE idempotency_key = ?
  `, [resourceId, responseDataJson, idempotencyKey]);
};

const tryAcquireIdempotencyKey = (idempotencyKey, actionType) => {
  const existing = getIdempotencyKey(idempotencyKey);
  if (existing) {
    return false;
  }
  
  const result = createIdempotencyKey({
    idempotencyKey,
    actionType,
    resourceId: null,
    responseData: null,
    expiresAt: null
  });
  return result !== null;
};

module.exports = {
  getIdempotencyKey,
  createIdempotencyKey,
  updateIdempotencyResponse,
  tryAcquireIdempotencyKey
};
