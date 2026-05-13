const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

class LockManager {
  constructor() {
    this.locks = new Map();
    this.lockTimeout = 30000;
  }

  generateLockKey(contractId, operation) {
    return `lock:${contractId}`;
  }

  async acquireLock(contractId, operation, options = {}) {
    const { timeout = this.lockTimeout, maxRetries = 5, retryDelay = 100 } = options;
    const lockKey = this.generateLockKey(contractId, operation);
    const lockId = uuidv4();

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (!this.locks.has(lockKey)) {
        this.locks.set(lockKey, {
          lockId,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + timeout),
          contractId,
          operation
        });

        setTimeout(() => {
          const currentLock = this.locks.get(lockKey);
          if (currentLock && currentLock.lockId === lockId) {
            this.locks.delete(lockKey);
          }
        }, timeout);

        return {
          acquired: true,
          lockId,
          lockKey
        };
      }

      await this.delay(retryDelay * (attempt + 1));
    }

    return {
      acquired: false,
      reason: '无法获取锁，操作可能正在进行中'
    };
  }

  async releaseLock(lockKey, lockId) {
    const currentLock = this.locks.get(lockKey);

    if (currentLock && currentLock.lockId === lockId) {
      this.locks.delete(lockKey);
      return { released: true };
    }

    return {
      released: false,
      reason: '锁不存在或已过期'
    };
  }

  async withLock(contractId, operation, fn, options = {}) {
    const lockResult = await this.acquireLock(contractId, operation, options);

    if (!lockResult.acquired) {
      throw new Error(`并发控制错误: ${lockResult.reason}`);
    }

    try {
      const result = await fn();
      return result;
    } finally {
      await this.releaseLock(lockResult.lockKey, lockResult.lockId);
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getActiveLocks() {
    const now = new Date();
    return Array.from(this.locks.entries())
      .filter(([, lock]) => lock.expiresAt > now)
      .map(([key, lock]) => ({
        lockKey: key,
        contractId: lock.contractId,
        operation: lock.operation,
        createdAt: lock.createdAt,
        expiresAt: lock.expiresAt,
        remainingMs: lock.expiresAt - now
      }));
  }

  clearExpiredLocks() {
    const now = new Date();
    let cleared = 0;

    for (const [key, lock] of this.locks.entries()) {
      if (lock.expiresAt < now) {
        this.locks.delete(key);
        cleared++;
      }
    }

    return { cleared };
  }
}

const lockManager = new LockManager();

async function withContractLock(contractId, operation, fn, options = {}) {
  return lockManager.withLock(contractId, operation, fn, options);
}

async function verifyStateTransition(contract, currentState, targetState) {
  if (contract.status !== currentState) {
    return {
      valid: false,
      reason: `状态不一致: 预期 ${currentState}, 实际 ${contract.status}`
    };
  }

  const stateMachineService = require('./stateMachineService');
  const transition = stateMachineService.canTransition(currentState, targetState);

  if (!transition.allowed) {
    return {
      valid: false,
      reason: transition.reason
    };
  }

  return { valid: true };
}

async function atomicUpdate(
  model,
  query,
  update,
  options = {}
) {
  const {
    versionField = 'docVersion',
    maxRetries = 3,
    retryDelay = 100
  } = options;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const doc = await model.findOne(query);

      if (!doc) {
        return {
          success: false,
          reason: '文档不存在'
        };
      }

      const currentVersion = doc[versionField] || 0;

      const result = await model.findOneAndUpdate(
        { ...query, [versionField]: currentVersion },
        { ...update, $inc: { [versionField]: 1 } },
        { new: true, runValidators: true }
      );

      if (result) {
        return {
          success: true,
          document: result
        };
      }
    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw error;
      }
    }

    await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
  }

  return {
    success: false,
    reason: '并发更新冲突，已达最大重试次数'
  };
}

async function handleConcurrentOperations(contractId, operation, handler) {
  try {
    const result = await withContractLock(contractId, operation, handler);
    return {
      success: true,
      data: result
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      isConcurrencyError: error.message.includes('并发控制')
    };
  }
}

module.exports = {
  LockManager,
  lockManager,
  withContractLock,
  verifyStateTransition,
  atomicUpdate,
  handleConcurrentOperations
};
