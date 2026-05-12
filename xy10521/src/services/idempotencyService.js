const { storage, save } = require('../utils/storage');
const config = require('../../config.json');

async function checkAndRecord(idempotencyKey, context) {
  const existing = storage.idempotencyKeys[idempotencyKey];
  
  if (existing) {
    if (existing.expiresAt && new Date() > new Date(existing.expiresAt)) {
      delete storage.idempotencyKeys[idempotencyKey];
      await save();
      return { exists: false };
    }
    
    return {
      exists: true,
      result: existing.result
    };
  }
  
  storage.idempotencyKeys[idempotencyKey] = {
    idempotencyKey,
    context,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + (config.idempotencyExpiryHours || 24) * 60 * 60 * 1000).toISOString(),
    result: null
  };
  
  await save();
  return { exists: false };
}

async function recordResult(idempotencyKey, result) {
  const record = storage.idempotencyKeys[idempotencyKey];
  if (record) {
    record.result = result;
    record.processedAt = new Date().toISOString();
    await save();
  }
}

async function clearExpired() {
  const now = new Date();
  let cleared = 0;
  
  for (const [key, record] of Object.entries(storage.idempotencyKeys)) {
    if (record.expiresAt && now > new Date(record.expiresAt)) {
      delete storage.idempotencyKeys[key];
      cleared++;
    }
  }
  
  if (cleared > 0) {
    await save();
  }
  
  return cleared;
}

module.exports = {
  checkAndRecord,
  recordResult,
  clearExpired
};