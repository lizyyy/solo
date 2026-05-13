const db = require('../db');
const { generateId, now, AppError } = require('../utils');
const { LOCK_TYPES, LOCK_STATUSES, getResource, isValidResourceType, isValidLockType } = require('./resourceService');

const LOCK_DURATION_MINUTES = 30;

function addMinutes(dateStr, minutes) {
  const date = new Date(dateStr.replace(' ', 'T'));
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

function acquireLock(resourceType, resourceId, meetingId, transactionId, lockType = LOCK_TYPES.PENDING) {
  if (!isValidResourceType(resourceType)) {
    throw new AppError(`Invalid resource type: ${resourceType}`, 400, 'INVALID_RESOURCE_TYPE');
  }
  if (!isValidLockType(lockType)) {
    throw new AppError(`Invalid lock type: ${lockType}`, 400, 'INVALID_LOCK_TYPE');
  }

  const resource = getResource(resourceType, resourceId);
  if (!resource) {
    throw new AppError(`Resource not found: ${resourceType}:${resourceId}`, 404, 'RESOURCE_NOT_FOUND');
  }

  const existingLocks = db.prepare(`
    SELECT * FROM resource_locks
    WHERE resource_type = ? AND resource_id = ? AND status = ?
  `).all(resourceType, resourceId, LOCK_STATUSES.ACTIVE);

  for (const lock of existingLocks) {
    if (lockType === LOCK_TYPES.EXCLUSIVE) {
      throw new AppError(
        `Resource ${resourceType}:${resourceId} is already locked`,
        409,
        'RESOURCE_LOCKED'
      );
    }
    if (lock.lock_type === LOCK_TYPES.EXCLUSIVE) {
      throw new AppError(
        `Resource ${resourceType}:${resourceId} is exclusively locked`,
        409,
        'RESOURCE_EXCLUSIVE_LOCKED'
      );
    }
  }

  const cleanupStmt = db.prepare(`
    DELETE FROM resource_locks
    WHERE resource_type = ? AND resource_id = ? AND lock_type = ? AND status != ?
  `);
  cleanupStmt.run(resourceType, resourceId, lockType, LOCK_STATUSES.ACTIVE);

  const id = generateId();
  const expiresAt = addMinutes(now(), LOCK_DURATION_MINUTES);
  
  const stmt = db.prepare(`
    INSERT INTO resource_locks (
      id, resource_type, resource_id, meeting_id, transaction_id,
      lock_type, status, expires_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id, resourceType, resourceId, meetingId, transactionId,
    lockType, LOCK_STATUSES.ACTIVE, expiresAt, now(), now()
  );
  return getLock(id);
}

function getLock(id) {
  return db.prepare('SELECT * FROM resource_locks WHERE id = ?').get(id);
}

function getLocksByTransaction(transactionId) {
  return db.prepare(`
    SELECT * FROM resource_locks WHERE transaction_id = ? ORDER BY created_at ASC
  `).all(transactionId);
}

function getLocksByMeeting(meetingId) {
  return db.prepare(`
    SELECT * FROM resource_locks WHERE meeting_id = ? AND status = ? ORDER BY created_at ASC
  `).all(meetingId, LOCK_STATUSES.ACTIVE);
}

function releaseLock(lockId) {
  const lock = getLock(lockId);
  if (!lock) {
    throw new AppError(`Lock not found: ${lockId}`, 404, 'LOCK_NOT_FOUND');
  }
  
  const stmt = db.prepare(`
    UPDATE resource_locks SET status = ?, updated_at = ? WHERE id = ?
  `);
  stmt.run(LOCK_STATUSES.RELEASED, now(), lockId);
  return getLock(lockId);
}

function releaseLocksByTransaction(transactionId) {
  const locks = getLocksByTransaction(transactionId);
  for (const lock of locks) {
    releaseLock(lock.id);
  }
  return locks.length;
}

function releaseLocksByMeeting(meetingId) {
  const locks = getLocksByMeeting(meetingId);
  for (const lock of locks) {
    releaseLock(lock.id);
  }
  return locks.length;
}

function upgradeLock(lockId, newLockType) {
  if (!isValidLockType(newLockType)) {
    throw new AppError(`Invalid lock type: ${newLockType}`, 400, 'INVALID_LOCK_TYPE');
  }

  const lock = getLock(lockId);
  if (!lock) {
    throw new AppError(`Lock not found: ${lockId}`, 404, 'LOCK_NOT_FOUND');
  }

  if (lock.status !== LOCK_STATUSES.ACTIVE) {
    throw new AppError(`Lock is not active`, 400, 'LOCK_NOT_ACTIVE');
  }

  if (newLockType === LOCK_TYPES.EXCLUSIVE) {
    const otherLocks = db.prepare(`
      SELECT * FROM resource_locks
      WHERE resource_type = ? AND resource_id = ? AND status = ? AND id != ?
    `).all(lock.resource_type, lock.resource_id, LOCK_STATUSES.ACTIVE, lockId);

    if (otherLocks.length > 0) {
      throw new AppError(
        `Cannot upgrade to exclusive lock: other locks exist`,
        409,
        'CANNOT_UPGRADE_LOCK'
      );
    }
  }

  const stmt = db.prepare(`
    UPDATE resource_locks SET lock_type = ?, updated_at = ? WHERE id = ?
  `);
  stmt.run(newLockType, now(), lockId);
  return getLock(lockId);
}

function renewLock(lockId, additionalMinutes = LOCK_DURATION_MINUTES) {
  const lock = getLock(lockId);
  if (!lock) {
    throw new AppError(`Lock not found: ${lockId}`, 404, 'LOCK_NOT_FOUND');
  }

  if (lock.status !== LOCK_STATUSES.ACTIVE) {
    throw new AppError(`Lock is not active`, 400, 'LOCK_NOT_ACTIVE');
  }

  const expiresAt = addMinutes(now(), additionalMinutes);
  const stmt = db.prepare(`
    UPDATE resource_locks SET expires_at = ?, updated_at = ? WHERE id = ?
  `);
  stmt.run(expiresAt, now(), lockId);
  return getLock(lockId);
}

function cleanupExpiredLocks() {
  const stmt = db.prepare(`
    UPDATE resource_locks SET status = ?, updated_at = ?
    WHERE status = ? AND expires_at < ?
  `);
  const result = stmt.run(LOCK_STATUSES.EXPIRED, now(), LOCK_STATUSES.ACTIVE, now());
  return result.changes;
}

module.exports = {
  LOCK_DURATION_MINUTES,
  acquireLock,
  getLock,
  getLocksByTransaction,
  getLocksByMeeting,
  releaseLock,
  releaseLocksByTransaction,
  releaseLocksByMeeting,
  upgradeLock,
  renewLock,
  cleanupExpiredLocks,
};
