const { v4: uuidv4 } = require('uuid');
const db = require('../models');

const LOCK_TIMEOUT = 30000;

const lockService = {
  async acquireLock(resourceType, resourceId, userId, operation = null) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + LOCK_TIMEOUT);

    try {
      const lock = await db.LockRecord.create({
        id: uuidv4(),
        resourceType,
        resourceId,
        lockedBy: userId,
        lockedAt: now,
        expiresAt,
        operation
      });
      return {
        success: true,
        lock
      };
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        const existingLock = await db.LockRecord.findOne({
          where: { resourceType, resourceId }
        });

        if (existingLock && existingLock.expiresAt < now) {
          await existingLock.destroy();
          return await this.acquireLock(resourceType, resourceId, userId, operation);
        }

        return {
          success: false,
          message: '资源已被锁定',
          existingLock: existingLock ? {
            lockedBy: existingLock.lockedBy,
            lockedAt: existingLock.lockedAt,
            expiresAt: existingLock.expiresAt,
            operation: existingLock.operation
          } : null
        };
      }
      throw error;
    }
  },

  async releaseLock(resourceType, resourceId) {
    return await db.LockRecord.destroy({
      where: { resourceType, resourceId }
    });
  },

  async getLock(resourceType, resourceId) {
    const lock = await db.LockRecord.findOne({
      where: { resourceType, resourceId }
    });

    if (!lock) return null;

    const now = new Date();
    if (lock.expiresAt < now) {
      await lock.destroy();
      return null;
    }

    return lock;
  },

  async extendLock(resourceType, resourceId, additionalMs = LOCK_TIMEOUT) {
    const lock = await this.getLock(resourceType, resourceId);
    if (!lock) return null;

    const newExpiresAt = new Date(Date.now() + additionalMs);
    await lock.update({ expiresAt: newExpiresAt });

    return lock;
  },

  async cleanupExpiredLocks() {
    const now = new Date();
    return await db.LockRecord.destroy({
      where: {
        expiresAt: {
          [db.Sequelize.Op.lt]: now
        }
      }
    });
  }
};

module.exports = lockService;
