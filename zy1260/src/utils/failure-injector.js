const db = require('../config/database');

const STEPS = {
  WAREHOUSE_PREPARE: 'WAREHOUSE_PREPARE',
  WAREHOUSE_CONFIRM: 'WAREHOUSE_CONFIRM',
  WAREHOUSE_CANCEL: 'WAREHOUSE_CANCEL',
  ACCOUNT_PREPARE: 'ACCOUNT_PREPARE',
  ACCOUNT_CONFIRM: 'ACCOUNT_CONFIRM',
  ACCOUNT_CANCEL: 'ACCOUNT_CANCEL',
  LOGISTICS_PREPARE: 'LOGISTICS_PREPARE',
  LOGISTICS_CONFIRM: 'LOGISTICS_CONFIRM',
  LOGISTICS_CANCEL: 'LOGISTICS_CANCEL'
};

const FAILURE_TYPES = {
  ERROR: 'ERROR',
  TIMEOUT: 'TIMEOUT'
};

const FailureInjector = {
  STEPS,
  FAILURE_TYPES,

  inject: (step, failureType = FAILURE_TYPES.ERROR) => {
    db.prepare(`
      INSERT INTO failure_injections (step, failure_type, is_active) VALUES (?, ?, 1)
    `).run(step, failureType);

    return {
      success: true,
      step,
      failureType,
      message: `已在 ${step} 步骤注入 ${failureType} 失败`
    };
  },

  check: (step) => {
    const injection = db.prepare(`
      SELECT * FROM failure_injections 
      WHERE step = ? AND is_active = 1
      ORDER BY created_at DESC
      LIMIT 1
    `).get(step);

    if (!injection) {
      return { shouldFail: false };
    }

    return {
      shouldFail: true,
      failureType: injection.failure_type,
      injectionId: injection.id
    };
  },

  simulate: (step, timeoutMs = 5000) => {
    const result = this.check(step);
    
    if (!result.shouldFail) {
      return { proceed: true };
    }

    if (result.failureType === FAILURE_TYPES.TIMEOUT) {
      return {
        proceed: false,
        action: 'timeout',
        timeoutMs,
        message: `${step} 步骤超时 (${timeoutMs}ms)`
      };
    }

    return {
      proceed: false,
      action: 'error',
      message: `${step} 步骤模拟失败`
    };
  },

  clear: (step = null) => {
    if (step) {
      db.prepare(`
        UPDATE failure_injections SET is_active = 0 WHERE step = ? AND is_active = 1
      `).run(step);
      return { success: true, message: `已清除 ${step} 步骤的失败注入` };
    }
    
    db.prepare('UPDATE failure_injections SET is_active = 0 WHERE is_active = 1').run();
    return { success: true, message: '已清除所有失败注入' };
  },

  listActive: () => {
    return db.prepare(`
      SELECT * FROM failure_injections WHERE is_active = 1 ORDER BY created_at DESC
    `).all();
  },

  listAll: () => {
    return db.prepare('SELECT * FROM failure_injections ORDER BY created_at DESC').all();
  }
};

module.exports = FailureInjector;
