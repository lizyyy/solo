const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { LOCK_TIMEOUT_SECONDS } = require('../utils/constants');

class LockService {
  static acquireLock(resourceType, resourceId, holderId, timeoutSeconds = LOCK_TIMEOUT_SECONDS) {
    return new Promise((resolve, reject) => {
      const lockId = uuidv4();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + timeoutSeconds * 1000);

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.get(
          `SELECT * FROM locks 
           WHERE resource_type = ? AND resource_id = ? 
           AND expires_at > ?`,
          [resourceType, resourceId, now.toISOString()],
          (err, existingLock) => {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
              return;
            }

            if (existingLock) {
              db.run('ROLLBACK');
              resolve({
                acquired: false,
                reason: '资源已被锁定',
                existingLock: {
                  holderId: existingLock.holder_id,
                  acquiredAt: existingLock.acquired_at,
                  expiresAt: existingLock.expires_at
                }
              });
              return;
            }

            db.run(
              `INSERT INTO locks (id, resource_type, resource_id, holder_id, expires_at)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(resource_type, resource_id) DO UPDATE SET
                 holder_id = excluded.holder_id,
                 acquired_at = CURRENT_TIMESTAMP,
                 expires_at = excluded.expires_at`,
              [lockId, resourceType, resourceId, holderId, expiresAt.toISOString()],
              function(insertErr) {
                if (insertErr) {
                  db.run('ROLLBACK');
                  reject(insertErr);
                  return;
                }

                db.run('COMMIT', (commitErr) => {
                  if (commitErr) {
                    reject(commitErr);
                  } else {
                    resolve({
                      acquired: true,
                      lockId,
                      resourceType,
                      resourceId,
                      holderId,
                      expiresAt: expiresAt.toISOString()
                    });
                  }
                });
              }
            );
          }
        );
      });
    });
  }

  static releaseLock(resourceType, resourceId, holderId) {
    return new Promise((resolve, reject) => {
      db.run(
        `DELETE FROM locks 
         WHERE resource_type = ? AND resource_id = ? AND holder_id = ?`,
        [resourceType, resourceId, holderId],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({
              released: this.changes > 0,
              changes: this.changes
            });
          }
        }
      );
    });
  }

  static getLock(resourceType, resourceId) {
    return new Promise((resolve, reject) => {
      const now = new Date();
      db.get(
        `SELECT * FROM locks 
         WHERE resource_type = ? AND resource_id = ? 
         AND expires_at > ?`,
        [resourceType, resourceId, now.toISOString()],
        (err, row) => {
          if (err) {
            reject(err);
          } else if (row) {
            resolve({
              exists: true,
              lock: {
                lockId: row.id,
                holderId: row.holder_id,
                acquiredAt: row.acquired_at,
                expiresAt: row.expires_at
              }
            });
          } else {
            resolve({ exists: false });
          }
        }
      );
    });
  }

  static checkAndAcquireRequestLock(requestId, travelerId) {
    return this.acquireLock('request', requestId, travelerId);
  }

  static releaseRequestLock(requestId, travelerId) {
    return this.releaseLock('request', requestId, travelerId);
  }

  static isRequestLocked(requestId) {
    return this.getLock('request', requestId);
  }

  static cleanExpiredLocks() {
    return new Promise((resolve, reject) => {
      const now = new Date();
      db.run(
        `DELETE FROM locks WHERE expires_at <= ?`,
        [now.toISOString()],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({
              cleaned: this.changes
            });
          }
        }
      );
    });
  }

  static executeWithLock(resourceType, resourceId, holderId, callback, timeoutSeconds = LOCK_TIMEOUT_SECONDS) {
    return new Promise(async (resolve, reject) => {
      let lockAcquired = false;
      let result;

      try {
        const lockResult = await this.acquireLock(resourceType, resourceId, holderId, timeoutSeconds);
        
        if (!lockResult.acquired) {
          resolve({
            success: false,
            reason: '无法获取锁',
            lockInfo: lockResult
          });
          return;
        }

        lockAcquired = true;
        result = await callback();

        await this.releaseLock(resourceType, resourceId, holderId);

        resolve({
          success: true,
          result,
          lockReleased: true
        });

      } catch (err) {
        if (lockAcquired) {
          try {
            await this.releaseLock(resourceType, resourceId, holderId);
          } catch (releaseErr) {
            console.error('释放锁时出错:', releaseErr);
          }
        }
        reject(err);
      }
    });
  }
}

module.exports = LockService;
