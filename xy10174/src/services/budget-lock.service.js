const { v4: uuidv4 } = require('uuid');
const { getKnex } = require('../db/knex');
const { AppError, errorCodes } = require('../utils/response');

const LOCK_DURATION_HOURS = 24;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 100;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class BudgetLockService {
  constructor() {
    this.db = getKnex();
  }

  async getBudgetById(budgetId) {
    return await this.db('budgets').where('id', budgetId).first();
  }

  async getBudgetByDepartmentAndType(departmentId, budgetType, fiscalYear) {
    return await this.db('budgets')
      .where('department_id', departmentId)
      .where('budget_type', budgetType)
      .where('fiscal_year', fiscalYear)
      .first();
  }

  async createBudget(data) {
    const totalAmount = parseFloat(data.total_amount);
    const usedAmount = parseFloat(data.used_amount || 0);
    const lockedAmount = parseFloat(data.locked_amount || 0);
    
    if (isNaN(totalAmount) || totalAmount < 0) {
      throw new AppError(errorCodes.VALIDATION_ERROR, {
        field: 'totalAmount',
        message: '总预算金额不能为负数',
        provided: data.total_amount
      });
    }
    
    if (isNaN(usedAmount) || usedAmount < 0) {
      throw new AppError(errorCodes.VALIDATION_ERROR, {
        field: 'usedAmount',
        message: '已使用金额不能为负数',
        provided: data.used_amount
      });
    }
    
    if (isNaN(lockedAmount) || lockedAmount < 0) {
      throw new AppError(errorCodes.VALIDATION_ERROR, {
        field: 'lockedAmount',
        message: '已锁定金额不能为负数',
        provided: data.locked_amount
      });
    }
    
    const id = uuidv4();
    const now = new Date();
    
    const availableAmount = totalAmount - usedAmount - lockedAmount;
    
    await this.db('budgets').insert({
      id,
      department_id: data.department_id,
      budget_type: data.budget_type,
      fiscal_year: data.fiscal_year,
      total_amount: totalAmount,
      used_amount: usedAmount,
      locked_amount: lockedAmount,
      available_amount: availableAmount,
      start_date: data.start_date,
      end_date: data.end_date,
      is_active: data.is_active !== undefined ? data.is_active : true,
      version: 1,
      created_at: now,
      updated_at: now
    });
    
    return await this.getBudgetById(id);
  }

  async lockBudget(data) {
    let lastError = null;
    
    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        const result = await this._lockBudgetWithRetry(data);
        return result;
      } catch (error) {
        lastError = error;
        if (error.code === errorCodes.CONCURRENT_CONFLICT.code && 
            attempt < MAX_RETRY_ATTEMPTS - 1) {
          await delay(RETRY_DELAY_MS * (attempt + 1));
          continue;
        }
        throw error;
      }
    }
    
    throw lastError;
  }

  async _lockBudgetWithRetry(data) {
    const { 
      budgetId, 
      applicationId, 
      applicationType, 
      amount, 
      createdBy, 
      reason,
      lockDurationHours 
    } = data;

    const requestAmount = parseFloat(amount);
    if (isNaN(requestAmount) || requestAmount <= 0) {
      throw new AppError(errorCodes.VALIDATION_ERROR, {
        field: 'amount',
        message: '锁定金额必须为正数',
        provided: amount
      });
    }

    return await this.db.transaction(async (trx) => {
      const existingLock = await trx('budget_locks')
        .where('application_id', applicationId)
        .first();
      
      if (existingLock && existingLock.status === 'ACTIVE') {
        throw new AppError(errorCodes.LOCK_ALREADY_EXISTS, {
          applicationId,
          existingLockId: existingLock.id
        });
      }

      const budget = await trx('budgets')
        .where('id', budgetId)
        .forUpdate()
        .first();

      if (!budget) {
        throw new AppError(errorCodes.BUDGET_NOT_FOUND, { budgetId });
      }

      if (!budget.is_active) {
        throw new AppError(errorCodes.BUDGET_DISABLED, { budgetId });
      }

      const now = new Date();
      if (new Date(budget.end_date) < now) {
        throw new AppError(errorCodes.BUDGET_EXPIRED, { 
          budgetId, 
          endDate: budget.end_date 
        });
      }

      const availableAmount = parseFloat(budget.available_amount);
      
      if (availableAmount < requestAmount) {
        throw new AppError(errorCodes.BUDGET_INSUFFICIENT, {
          budgetId,
          requested: requestAmount,
          available: availableAmount,
          total: parseFloat(budget.total_amount),
          used: parseFloat(budget.used_amount),
          locked: parseFloat(budget.locked_amount)
        });
      }

      const currentVersion = budget.version;
      const hours = lockDurationHours || LOCK_DURATION_HOURS;
      const expiresAt = new Date(now.getTime() + hours * 60 * 60 * 1000);
      
      const newLockedAmount = parseFloat(budget.locked_amount) + requestAmount;
      const newAvailableAmount = availableAmount - requestAmount;
      
      const updateCount = await trx('budgets')
        .where('id', budgetId)
        .where('version', currentVersion)
        .update({
          locked_amount: newLockedAmount,
          available_amount: newAvailableAmount,
          version: currentVersion + 1,
          updated_at: now
        });

      if (updateCount === 0) {
        throw new AppError(errorCodes.CONCURRENT_CONFLICT, {
          budgetId,
          expectedVersion: currentVersion
        });
      }

      const lockId = uuidv4();
      await trx('budget_locks').insert({
        id: lockId,
        budget_id: budgetId,
        department_id: budget.department_id,
        application_id: applicationId,
        application_type: applicationType,
        amount: requestAmount,
        status: 'ACTIVE',
        expires_at: expiresAt,
        created_by: createdBy,
        reason: reason,
        version: 1,
        created_at: now,
        updated_at: now
      });

      await this._logTransaction(trx, {
        operationType: 'BUDGET_LOCK',
        referenceId: lockId,
        referenceType: 'BUDGET_LOCK',
        budgetId,
        departmentId: budget.department_id,
        amount: requestAmount,
        operator: createdBy,
        details: JSON.stringify({ applicationId, applicationType, reason })
      });

      return {
        lockId,
        applicationId,
        amount: requestAmount,
        expiresAt,
        budgetId,
        newLockedAmount,
        newAvailableAmount
      };
    });
  }

  async updateLock(data) {
    const { lockId, newAmount, operator } = data;
    
    const newAmountVal = parseFloat(newAmount);
    if (isNaN(newAmountVal) || newAmountVal <= 0) {
      throw new AppError(errorCodes.VALIDATION_ERROR, {
        field: 'newAmount',
        message: '锁定金额必须为正数',
        provided: newAmount
      });
    }
    
    return await this.db.transaction(async (trx) => {
      const lock = await trx('budget_locks')
        .where('id', lockId)
        .forUpdate()
        .first();

      if (!lock) {
        throw new AppError(errorCodes.LOCK_NOT_FOUND, { lockId });
      }

      if (lock.status === 'RELEASED') {
        throw new AppError(errorCodes.LOCK_ALREADY_RELEASED, { lockId });
      }

      if (lock.status === 'COMMITTED') {
        throw new AppError(errorCodes.LOCK_ALREADY_COMMITTED, { lockId });
      }

      const now = new Date();
      if (new Date(lock.expires_at) < now) {
        throw new AppError(errorCodes.LOCK_EXPIRED, { 
          lockId, 
          expiresAt: lock.expires_at 
        });
      }

      const oldAmount = parseFloat(lock.amount);
      const amountDiff = newAmountVal - oldAmount;

      if (Math.abs(amountDiff) < 0.01) {
        return { lockId, unchanged: true };
      }

      const budget = await trx('budgets')
        .where('id', lock.budget_id)
        .forUpdate()
        .first();

      if (!budget) {
        throw new AppError(errorCodes.BUDGET_NOT_FOUND, { budgetId: lock.budget_id });
      }

      if (amountDiff > 0) {
        const availableAmount = parseFloat(budget.available_amount);
        if (availableAmount < amountDiff) {
          throw new AppError(errorCodes.BUDGET_INSUFFICIENT, {
            budgetId: lock.budget_id,
            additionalNeeded: amountDiff,
            available: availableAmount
          });
        }
      }

      const currentVersion = budget.version;
      const newLockedAmount = parseFloat(budget.locked_amount) + amountDiff;
      const newAvailableAmount = parseFloat(budget.available_amount) - amountDiff;

      const updateCount = await trx('budgets')
        .where('id', lock.budget_id)
        .where('version', currentVersion)
        .update({
          locked_amount: newLockedAmount,
          available_amount: newAvailableAmount,
          version: currentVersion + 1,
          updated_at: now
        });

      if (updateCount === 0) {
        throw new AppError(errorCodes.CONCURRENT_CONFLICT, {
          budgetId: lock.budget_id,
          lockId
        });
      }

      const lockVersion = lock.version;
      const lockUpdateCount = await trx('budget_locks')
        .where('id', lockId)
        .where('version', lockVersion)
        .update({
          amount: newAmountVal,
          version: lockVersion + 1,
          updated_at: now
        });

      if (lockUpdateCount === 0) {
        throw new AppError(errorCodes.CONCURRENT_CONFLICT, { lockId });
      }

      await this._logTransaction(trx, {
        operationType: 'BUDGET_LOCK_UPDATE',
        referenceId: lockId,
        referenceType: 'BUDGET_LOCK',
        budgetId: lock.budget_id,
        departmentId: lock.department_id,
        amount: amountDiff,
        operator,
        details: JSON.stringify({ oldAmount, newAmount: newAmountVal })
      });

      return {
        lockId,
        oldAmount,
        newAmount: newAmountVal,
        amountDiff,
        newLockedAmount,
        newAvailableAmount
      };
    });
  }

  async releaseLock(data, existingTrx = null) {
    const { lockId, operator, reason } = data;
    
    const execute = async (trx) => {
      const lock = await trx('budget_locks')
        .where('id', lockId)
        .forUpdate()
        .first();

      if (!lock) {
        throw new AppError(errorCodes.LOCK_NOT_FOUND, { lockId });
      }

      if (lock.status === 'RELEASED') {
        throw new AppError(errorCodes.LOCK_ALREADY_RELEASED, { lockId });
      }

      if (lock.status === 'COMMITTED') {
        throw new AppError(errorCodes.LOCK_ALREADY_COMMITTED, { lockId });
      }

      const budget = await trx('budgets')
        .where('id', lock.budget_id)
        .forUpdate()
        .first();

      if (!budget) {
        throw new AppError(errorCodes.BUDGET_NOT_FOUND, { budgetId: lock.budget_id });
      }

      const now = new Date();
      const lockedAmount = parseFloat(lock.amount);
      const currentVersion = budget.version;
      
      const newLockedAmount = parseFloat(budget.locked_amount) - lockedAmount;
      const newAvailableAmount = parseFloat(budget.available_amount) + lockedAmount;

      const updateCount = await trx('budgets')
        .where('id', lock.budget_id)
        .where('version', currentVersion)
        .update({
          locked_amount: newLockedAmount,
          available_amount: newAvailableAmount,
          version: currentVersion + 1,
          updated_at: now
        });

      if (updateCount === 0) {
        throw new AppError(errorCodes.CONCURRENT_CONFLICT, {
          budgetId: lock.budget_id,
          lockId
        });
      }

      const lockVersion = lock.version;
      const lockUpdateCount = await trx('budget_locks')
        .where('id', lockId)
        .where('version', lockVersion)
        .update({
          status: 'RELEASED',
          version: lockVersion + 1,
          updated_at: now
        });

      if (lockUpdateCount === 0) {
        throw new AppError(errorCodes.CONCURRENT_CONFLICT, { lockId });
      }

      await this._logTransaction(trx, {
        operationType: 'BUDGET_LOCK_RELEASE',
        referenceId: lockId,
        referenceType: 'BUDGET_LOCK',
        budgetId: lock.budget_id,
        departmentId: lock.department_id,
        amount: lockedAmount,
        oldStatus: 'ACTIVE',
        newStatus: 'RELEASED',
        operator,
        details: JSON.stringify({ reason })
      });

      return {
        lockId,
        releasedAmount: lockedAmount,
        newLockedAmount,
        newAvailableAmount
      };
    };

    if (existingTrx) {
      return await execute(existingTrx);
    } else {
      return await this.db.transaction(async (trx) => {
        return await execute(trx);
      });
    }
  }

  async commitLock(data, existingTrx = null) {
    const { lockId, operator } = data;
    
    const execute = async (trx) => {
      const lock = await trx('budget_locks')
        .where('id', lockId)
        .forUpdate()
        .first();

      if (!lock) {
        throw new AppError(errorCodes.LOCK_NOT_FOUND, { lockId });
      }

      if (lock.status === 'RELEASED') {
        throw new AppError(errorCodes.LOCK_ALREADY_RELEASED, { lockId });
      }

      if (lock.status === 'COMMITTED') {
        throw new AppError(errorCodes.LOCK_ALREADY_COMMITTED, { lockId });
      }

      const budget = await trx('budgets')
        .where('id', lock.budget_id)
        .forUpdate()
        .first();

      if (!budget) {
        throw new AppError(errorCodes.BUDGET_NOT_FOUND, { budgetId: lock.budget_id });
      }

      const now = new Date();
      const lockedAmount = parseFloat(lock.amount);
      const currentVersion = budget.version;
      
      const newLockedAmount = parseFloat(budget.locked_amount) - lockedAmount;
      const newUsedAmount = parseFloat(budget.used_amount) + lockedAmount;

      const updateCount = await trx('budgets')
        .where('id', lock.budget_id)
        .where('version', currentVersion)
        .update({
          locked_amount: newLockedAmount,
          used_amount: newUsedAmount,
          version: currentVersion + 1,
          updated_at: now
        });

      if (updateCount === 0) {
        throw new AppError(errorCodes.CONCURRENT_CONFLICT, {
          budgetId: lock.budget_id,
          lockId
        });
      }

      const lockVersion = lock.version;
      const lockUpdateCount = await trx('budget_locks')
        .where('id', lockId)
        .where('version', lockVersion)
        .update({
          status: 'COMMITTED',
          version: lockVersion + 1,
          updated_at: now
        });

      if (lockUpdateCount === 0) {
        throw new AppError(errorCodes.CONCURRENT_CONFLICT, { lockId });
      }

      await this._logTransaction(trx, {
        operationType: 'BUDGET_LOCK_COMMIT',
        referenceId: lockId,
        referenceType: 'BUDGET_LOCK',
        budgetId: lock.budget_id,
        departmentId: lock.department_id,
        amount: lockedAmount,
        oldStatus: 'ACTIVE',
        newStatus: 'COMMITTED',
        operator,
        details: JSON.stringify({ applicationId: lock.application_id })
      });

      return {
        lockId,
        committedAmount: lockedAmount,
        newUsedAmount,
        newLockedAmount
      };
    };

    if (existingTrx) {
      return await execute(existingTrx);
    } else {
      return await this.db.transaction(async (trx) => {
        return await execute(trx);
      });
    }
  }

  async getLockByApplicationId(applicationId) {
    return await this.db('budget_locks')
      .where('application_id', applicationId)
      .first();
  }

  async getLockById(lockId) {
    return await this.db('budget_locks')
      .where('id', lockId)
      .first();
  }

  async _logTransaction(trx, data) {
    await trx('transaction_logs').insert({
      id: uuidv4(),
      operation_type: data.operationType,
      reference_id: data.referenceId,
      reference_type: data.referenceType,
      budget_id: data.budgetId,
      department_id: data.departmentId,
      amount: data.amount,
      old_status: data.oldStatus,
      new_status: data.newStatus,
      operator: data.operator,
      details: data.details,
      created_at: new Date()
    });
  }

  async compensateByLog(logId, operator) {
    const log = await this.db('transaction_logs')
      .where('id', logId)
      .first();
    
    if (!log) {
      throw new AppError(errorCodes.INTERNAL_ERROR, { logId, message: '交易日志不存在' });
    }

    const lock = await this.db('budget_locks')
      .where('id', log.reference_id)
      .first();
    
    if (lock && lock.status === 'ACTIVE') {
      return await this.releaseLock({
        lockId: lock.id,
        operator,
        reason: `补偿操作: 基于日志 ${logId}`
      });
    }

    return { compensated: false, reason: '无需补偿' };
  }
}

module.exports = BudgetLockService;
