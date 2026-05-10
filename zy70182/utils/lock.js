const { table, generateId, now } = require('./db');
const moment = require('moment');

const LOCK_TIMEOUT_SECONDS = 30;

function acquireLock(resourceType, resourceId, holderId) {
  const locks = table('resource_locks');
  const acquiredAt = now();
  const expiresAt = moment(acquiredAt).add(LOCK_TIMEOUT_SECONDS, 'seconds').format('YYYY-MM-DD HH:mm:ss');
  
  try {
    const existingLock = locks.findOne({ 
      resource_type: resourceType, 
      resource_id: resourceId 
    });
    
    if (existingLock) {
      if (moment(existingLock.expires_at).isAfter(now())) {
        return {
          success: false,
          error: '资源已被锁定，请稍后再试',
          lockHolder: existingLock.lock_holder
        };
      }
      locks.delete(existingLock.id);
    }
    
    const lockId = generateId();
    locks.insert({
      id: lockId,
      resource_type: resourceType,
      resource_id: resourceId,
      lock_holder: holderId,
      acquired_at: acquiredAt,
      expires_at: expiresAt
    });
    
    return {
      success: true,
      lockId
    };
  } catch (err) {
    const existingLock = locks.findOne({ 
      resource_type: resourceType, 
      resource_id: resourceId 
    });
    return {
      success: false,
      error: '资源已被锁定，请稍后再试',
      lockHolder: existingLock?.lock_holder
    };
  }
}

function releaseLock(resourceType, resourceId) {
  const locks = table('resource_locks');
  const existingLock = locks.findOne({ 
    resource_type: resourceType, 
    resource_id: resourceId 
  });
  
  if (existingLock) {
    locks.delete(existingLock.id);
    return true;
  }
  
  return false;
}

function refreshLock(resourceType, resourceId) {
  const locks = table('resource_locks');
  const existingLock = locks.findOne({ 
    resource_type: resourceType, 
    resource_id: resourceId 
  });
  
  if (existingLock) {
    const expiresAt = moment().add(LOCK_TIMEOUT_SECONDS, 'seconds').format('YYYY-MM-DD HH:mm:ss');
    locks.update(existingLock.id, { expires_at: expiresAt });
    return true;
  }
  
  return false;
}

function isLocked(resourceType, resourceId) {
  const locks = table('resource_locks');
  const lock = locks.findOne({ 
    resource_type: resourceType, 
    resource_id: resourceId 
  });
  
  if (lock && moment(lock.expires_at).isAfter(now())) {
    return true;
  }
  
  return false;
}

module.exports = {
  acquireLock,
  releaseLock,
  refreshLock,
  isLocked
};
