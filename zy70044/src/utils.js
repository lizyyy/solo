const { v4: uuidv4 } = require('uuid');
const database = require('./database');

function generateId() {
  return uuidv4();
}

function now() {
  return Date.now();
}

function formatDate(timestamp) {
  const d = new Date(timestamp);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

const RESPONSIBILITIES = ['ASSEMBLY', 'TESTING', 'PACKAGING'];
const RESPONSIBILITY_NAMES = {
  ASSEMBLY: '装配',
  TESTING: '测试',
  PACKAGING: '包装'
};

const ORDER_STATUS = {
  PENDING: '待处理',
  PROCESSING: '处理中',
  FREEZED: '责任冻结',
  REJUDGING: '复判中',
  SETTLED: '已结算',
  CLOSED: '已关闭'
};

const REJUDGE_STATUS = {
  PENDING: '待审批',
  APPROVED: '已通过',
  REJECTED: '已驳回'
};

const SETTLEMENT_STATUS = {
  PENDING: '待确认',
  CONFIRMED: '已确认',
  PAID: '已付款'
};

class ResourceLock {
  constructor() {
    this.locks = new Map();
    this.lockTimeouts = new Map();
  }

  acquire(resourceKey, holderId, timeoutMs = 30000) {
    const nowTime = now();
    
    if (this.locks.has(resourceKey)) {
      const lockInfo = this.locks.get(resourceKey);
      if (lockInfo.expiresAt > nowTime && lockInfo.holderId !== holderId) {
        return { success: false, message: '资源已被锁定' };
      }
      this.locks.delete(resourceKey);
      if (this.lockTimeouts.has(resourceKey)) {
        clearTimeout(this.lockTimeouts.get(resourceKey));
        this.lockTimeouts.delete(resourceKey);
      }
    }

    const expiresAt = nowTime + timeoutMs;
    this.locks.set(resourceKey, {
      holderId,
      acquiredAt: nowTime,
      expiresAt
    });

    const timeout = setTimeout(() => {
      if (this.locks.has(resourceKey) && this.locks.get(resourceKey).holderId === holderId) {
        this.locks.delete(resourceKey);
        this.lockTimeouts.delete(resourceKey);
      }
    }, timeoutMs);
    this.lockTimeouts.set(resourceKey, timeout);

    return { success: true };
  }

  release(resourceKey, holderId) {
    if (!this.locks.has(resourceKey)) {
      return { success: true };
    }
    
    const lockInfo = this.locks.get(resourceKey);
    if (lockInfo.holderId !== holderId) {
      return { success: false, message: '无权释放此锁' };
    }

    this.locks.delete(resourceKey);
    if (this.lockTimeouts.has(resourceKey)) {
      clearTimeout(this.lockTimeouts.get(resourceKey));
      this.lockTimeouts.delete(resourceKey);
    }
    
    return { success: true };
  }

  isLocked(resourceKey) {
    const nowTime = now();
    if (!this.locks.has(resourceKey)) {
      return false;
    }
    const lockInfo = this.locks.get(resourceKey);
    return lockInfo.expiresAt > nowTime;
  }

  getLockInfo(resourceKey) {
    if (!this.locks.has(resourceKey)) {
      return null;
    }
    return this.locks.get(resourceKey);
  }
}

const lockManager = new ResourceLock();

class AuditLog {
  static log(module, action, targetId, operator, details, ip) {
    const id = generateId();
    const stmt = database.prepare(`
      INSERT INTO operation_logs (id, module, action, target_id, operator, operated_at, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, module, action, targetId, operator, now(), JSON.stringify(details), ip || null);
  }

  static getLogs(targetId, limit = 50) {
    const logs = database.prepare('SELECT * FROM operation_logs WHERE target_id = ? ORDER BY operated_at DESC').all(targetId);
    return logs.slice(0, limit);
  }

  static getAllLogs(module = null, limit = 100) {
    let logs;
    if (module) {
      logs = database.prepare('SELECT * FROM operation_logs WHERE module = ? ORDER BY operated_at DESC').all(module);
    } else {
      logs = database.prepare('SELECT * FROM operation_logs ORDER BY operated_at DESC').all();
    }
    return logs.slice(0, limit);
  }
}

module.exports = {
  generateId,
  now,
  formatDate,
  RESPONSIBILITIES,
  RESPONSIBILITY_NAMES,
  ORDER_STATUS,
  REJUDGE_STATUS,
  SETTLEMENT_STATUS,
  lockManager,
  AuditLog
};
