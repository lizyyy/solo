const { getDb } = require('./database');
const { v4: uuidv4 } = require('uuid');

const LOCK_TIMEOUT_MS = 30000;
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 200;

const getCurrentTime = () => new Date().toISOString();

const acquireLock = async (resourceType, resourceId) => {
  const db = getDb();
  const lockToken = uuidv4();
  const now = Date.now();
  const expiresAt = new Date(now + LOCK_TIMEOUT_MS).toISOString();
  const currentTimeStr = getCurrentTime();

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      db.prepare(`DELETE FROM resource_locks WHERE expires_at < ?`).run(currentTimeStr);
        
      const existingLock = db.prepare(`
        SELECT 1 FROM resource_locks WHERE resource_type = ? AND resource_id = ?
      `).get(resourceType, resourceId);
        
      if (existingLock) {
        if (attempt < MAX_RETRIES - 1) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
          continue;
        }
        return { success: false, error: '无法获取资源锁，请稍后重试' };
      }
        
      db.prepare(`
        INSERT INTO resource_locks (resource_type, resource_id, lock_token, expires_at)
        VALUES (?, ?, ?, ?)
      `).run(resourceType, resourceId, lockToken, expiresAt);
        
      return { success: true, lockToken };
    } catch (error) {
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        continue;
      }
      return { success: false, error: error.message };
    }
  }

  return { success: false, error: '无法获取资源锁，请稍后重试' };
};

const releaseLock = (resourceType, resourceId, lockToken) => {
  try {
    const db = getDb();
    const stmt = db.prepare(`
      DELETE FROM resource_locks 
      WHERE resource_type = ? AND resource_id = ? AND lock_token = ?
    `);
    const info = stmt.run(resourceType, resourceId, lockToken);
    return info.changes > 0;
  } catch (error) {
    return false;
  }
};

const verifyLock = (resourceType, resourceId, lockToken) => {
  try {
    const db = getDb();
    const currentTimeStr = getCurrentTime();
    const stmt = db.prepare(`
      SELECT 1 FROM resource_locks 
      WHERE resource_type = ? AND resource_id = ? AND lock_token = ? AND expires_at > ?
    `);
    const result = stmt.get(resourceType, resourceId, lockToken, currentTimeStr);
    return !!result;
  } catch (error) {
    return false;
  }
};

const withLock = async (resourceType, resourceId, fn) => {
  const lockResult = await acquireLock(resourceType, resourceId);
  
  if (!lockResult.success) {
    throw new Error(lockResult.error || '资源锁定失败');
  }

  try {
    const result = fn();
    return result;
  } finally {
    releaseLock(resourceType, resourceId, lockResult.lockToken);
  }
};

module.exports = {
  acquireLock,
  releaseLock,
  verifyLock,
  withLock
};
