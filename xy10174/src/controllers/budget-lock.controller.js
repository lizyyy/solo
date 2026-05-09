const { success, error, errorCodes } = require('../utils/response');
const BudgetLockService = require('../services/budget-lock.service');
const { v4: uuidv4 } = require('uuid');
const { getKnex } = require('../db/knex');

class BudgetLockController {
  constructor() {
    this.service = new BudgetLockService();
    this.db = getKnex();
  }

  async createDepartment(req, res) {
    try {
      const { name, code, parentId } = req.body;
      
      if (!name || !code) {
        return res.status(400).json(error(errorCodes.VALIDATION_ERROR, {
          missingFields: ['name', 'code'].filter(f => !req.body[f])
        }));
      }

      const id = uuidv4();
      const now = new Date();
      
      await this.db('departments').insert({
        id,
        name,
        code,
        parent_id: parentId,
        created_at: now,
        updated_at: now
      });

      const dept = await this.db('departments').where('id', id).first();
      res.json(success(dept, '部门创建成功'));
    } catch (err) {
      console.error('Create department error:', err);
      res.status(500).json(error(errorCodes.INTERNAL_ERROR, err.message));
    }
  }

  async createBudget(req, res) {
    try {
      const { 
        departmentId, 
        budgetType, 
        fiscalYear, 
        totalAmount, 
        startDate, 
        endDate 
      } = req.body;

      if (!departmentId || !budgetType || !fiscalYear || 
          totalAmount === undefined || !startDate || !endDate) {
        return res.status(400).json(error(errorCodes.VALIDATION_ERROR, {
          missingFields: ['departmentId', 'budgetType', 'fiscalYear', 
                         'totalAmount', 'startDate', 'endDate'].filter(f => req.body[f] === undefined)
        }));
      }

      const budget = await this.service.createBudget({
        department_id: departmentId,
        budget_type: budgetType,
        fiscal_year: fiscalYear,
        total_amount: totalAmount,
        start_date: startDate,
        end_date: endDate
      });

      res.json(success(budget, '预算创建成功'));
    } catch (err) {
      console.error('Create budget error:', err);
      res.status(500).json(error(errorCodes.INTERNAL_ERROR, err.message));
    }
  }

  async getBudget(req, res) {
    try {
      const { budgetId } = req.params;
      const budget = await this.service.getBudgetById(budgetId);
      
      if (!budget) {
        return res.status(404).json(error(errorCodes.BUDGET_NOT_FOUND, { budgetId }));
      }
      
      res.json(success(budget));
    } catch (err) {
      console.error('Get budget error:', err);
      res.status(500).json(error(errorCodes.INTERNAL_ERROR, err.message));
    }
  }

  async lockBudget(req, res) {
    try {
      const { 
        budgetId, 
        applicationId, 
        applicationType, 
        amount, 
        createdBy, 
        reason,
        lockDurationHours
      } = req.body;

      if (!budgetId || !applicationId || !applicationType || 
          amount === undefined || !createdBy) {
        return res.status(400).json(error(errorCodes.VALIDATION_ERROR, {
          missingFields: ['budgetId', 'applicationId', 'applicationType', 
                         'amount', 'createdBy'].filter(f => req.body[f] === undefined)
        }));
      }

      const result = await this.service.lockBudget({
        budgetId,
        applicationId,
        applicationType,
        amount,
        createdBy,
        reason,
        lockDurationHours
      });

      res.json(success(result, '预算锁定成功'));
    } catch (err) {
      console.error('Lock budget error:', err);
      if (err.code) {
        const statusCode = err.code >= 4000 ? 409 : 400;
        return res.status(statusCode).json({
          success: false,
          code: err.code,
          message: err.message,
          details: err.details,
          timestamp: Date.now()
        });
      }
      res.status(500).json(error(errorCodes.INTERNAL_ERROR, err.message));
    }
  }

  async updateLock(req, res) {
    try {
      const { lockId } = req.params;
      const { newAmount, operator } = req.body;

      if (!lockId || newAmount === undefined || !operator) {
        return res.status(400).json(error(errorCodes.VALIDATION_ERROR, {
          missingFields: ['lockId', 'newAmount', 'operator'].filter(f => 
            !lockId || (f === 'newAmount' && newAmount === undefined) || !operator
          )
        }));
      }

      const result = await this.service.updateLock({
        lockId,
        newAmount,
        operator
      });

      res.json(success(result, '锁定金额更新成功'));
    } catch (err) {
      console.error('Update lock error:', err);
      if (err.code) {
        const statusCode = err.code >= 4000 ? 409 : 400;
        return res.status(statusCode).json({
          success: false,
          code: err.code,
          message: err.message,
          details: err.details,
          timestamp: Date.now()
        });
      }
      res.status(500).json(error(errorCodes.INTERNAL_ERROR, err.message));
    }
  }

  async releaseLock(req, res) {
    try {
      const { lockId } = req.params;
      const { operator, reason } = req.body;

      if (!lockId || !operator) {
        return res.status(400).json(error(errorCodes.VALIDATION_ERROR, {
          missingFields: ['lockId', 'operator'].filter(f => !lockId || !operator)
        }));
      }

      const result = await this.service.releaseLock({
        lockId,
        operator,
        reason
      });

      res.json(success(result, '预算锁定已释放'));
    } catch (err) {
      console.error('Release lock error:', err);
      if (err.code) {
        const statusCode = err.code >= 4000 ? 409 : 400;
        return res.status(statusCode).json({
          success: false,
          code: err.code,
          message: err.message,
          details: err.details,
          timestamp: Date.now()
        });
      }
      res.status(500).json(error(errorCodes.INTERNAL_ERROR, err.message));
    }
  }

  async commitLock(req, res) {
    try {
      const { lockId } = req.params;
      const { operator } = req.body;

      if (!lockId || !operator) {
        return res.status(400).json(error(errorCodes.VALIDATION_ERROR, {
          missingFields: ['lockId', 'operator'].filter(f => !lockId || !operator)
        }));
      }

      const result = await this.service.commitLock({
        lockId,
        operator
      });

      res.json(success(result, '预算已提交使用'));
    } catch (err) {
      console.error('Commit lock error:', err);
      if (err.code) {
        const statusCode = err.code >= 4000 ? 409 : 400;
        return res.status(statusCode).json({
          success: false,
          code: err.code,
          message: err.message,
          details: err.details,
          timestamp: Date.now()
        });
      }
      res.status(500).json(error(errorCodes.INTERNAL_ERROR, err.message));
    }
  }

  async getLock(req, res) {
    try {
      const { lockId } = req.params;
      const lock = await this.service.getLockById(lockId);
      
      if (!lock) {
        return res.status(404).json(error(errorCodes.LOCK_NOT_FOUND, { lockId }));
      }
      
      res.json(success(lock));
    } catch (err) {
      console.error('Get lock error:', err);
      res.status(500).json(error(errorCodes.INTERNAL_ERROR, err.message));
    }
  }

  async getLockByApplication(req, res) {
    try {
      const { applicationId } = req.params;
      const lock = await this.service.getLockByApplicationId(applicationId);
      
      if (!lock) {
        return res.status(404).json(error(errorCodes.LOCK_NOT_FOUND, { applicationId }));
      }
      
      res.json(success(lock));
    } catch (err) {
      console.error('Get lock by application error:', err);
      res.status(500).json(error(errorCodes.INTERNAL_ERROR, err.message));
    }
  }
}

module.exports = BudgetLockController;
