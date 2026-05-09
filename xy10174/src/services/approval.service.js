const { v4: uuidv4 } = require('uuid');
const { getKnex } = require('../db/knex');
const { AppError, errorCodes } = require('../utils/response');
const BudgetLockService = require('./budget-lock.service');

class ApprovalService {
  constructor() {
    this.db = getKnex();
    this.budgetLockService = new BudgetLockService();
  }

  async createApproval(data) {
    const { applicationId, budgetLockId, currentApprover, approvalLevel, operator } = data;
    
    const now = new Date();
    const id = uuidv4();
    
    const existing = await this.db('approval_records')
      .where('application_id', applicationId)
      .first();
    
    if (existing) {
      return existing;
    }

    await this.db('approval_records').insert({
      id,
      budget_lock_id: budgetLockId,
      application_id: applicationId,
      status: 'PENDING',
      current_approver: currentApprover,
      approval_level: approvalLevel,
      version: 1,
      created_at: now,
      updated_at: now
    });

    return await this.getApprovalById(id);
  }

  async getApprovalById(id) {
    return await this.db('approval_records').where('id', id).first();
  }

  async getApprovalByApplicationId(applicationId) {
    return await this.db('approval_records')
      .where('application_id', applicationId)
      .first();
  }

  async approve(data) {
    const { approvalId, approvedBy, operator } = data;
    
    return await this.db.transaction(async (trx) => {
      const approval = await trx('approval_records')
        .where('id', approvalId)
        .forUpdate()
        .first();

      if (!approval) {
        throw new AppError(errorCodes.APPROVAL_NOT_FOUND, { approvalId });
      }

      if (approval.status === 'APPROVED') {
        throw new AppError(errorCodes.APPROVAL_ALREADY_COMPLETED, { 
          approvalId, 
          status: approval.status 
        });
      }

      if (approval.status === 'REJECTED' || approval.status === 'CANCELLED') {
        throw new AppError(errorCodes.APPROVAL_INVALID_STATUS, { 
          approvalId, 
          currentStatus: approval.status 
        });
      }

      const now = new Date();
      const currentVersion = approval.version;
      
      const updateCount = await trx('approval_records')
        .where('id', approvalId)
        .where('version', currentVersion)
        .update({
          status: 'APPROVED',
          approved_by: approvedBy,
          approved_at: now,
          version: currentVersion + 1,
          updated_at: now
        });

      if (updateCount === 0) {
        throw new AppError(errorCodes.APPROVAL_CONFLICT, { approvalId });
      }

      if (approval.budget_lock_id) {
        await this.budgetLockService.commitLock({
          lockId: approval.budget_lock_id,
          operator: operator || approvedBy
        }, trx);
      }

      return {
        approvalId,
        status: 'APPROVED',
        approvedAt: now
      };
    });
  }

  async reject(data) {
    const { approvalId, rejectReason, operator } = data;
    
    return await this.db.transaction(async (trx) => {
      const approval = await trx('approval_records')
        .where('id', approvalId)
        .forUpdate()
        .first();

      if (!approval) {
        throw new AppError(errorCodes.APPROVAL_NOT_FOUND, { approvalId });
      }

      if (approval.status === 'APPROVED' || 
          approval.status === 'REJECTED' || 
          approval.status === 'CANCELLED') {
        throw new AppError(errorCodes.APPROVAL_ALREADY_COMPLETED, { 
          approvalId, 
          status: approval.status 
        });
      }

      const now = new Date();
      const currentVersion = approval.version;
      
      const updateCount = await trx('approval_records')
        .where('id', approvalId)
        .where('version', currentVersion)
        .update({
          status: 'REJECTED',
          reject_reason: rejectReason,
          version: currentVersion + 1,
          updated_at: now
        });

      if (updateCount === 0) {
        throw new AppError(errorCodes.APPROVAL_CONFLICT, { approvalId });
      }

      if (approval.budget_lock_id) {
        await this.budgetLockService.releaseLock({
          lockId: approval.budget_lock_id,
          operator,
          reason: `审批被拒绝: ${rejectReason}`
        }, trx);
      }

      return {
        approvalId,
        status: 'REJECTED',
        rejectReason
      };
    });
  }

  async cancel(data) {
    const { approvalId, operator } = data;
    
    return await this.db.transaction(async (trx) => {
      const approval = await trx('approval_records')
        .where('id', approvalId)
        .forUpdate()
        .first();

      if (!approval) {
        throw new AppError(errorCodes.APPROVAL_NOT_FOUND, { approvalId });
      }

      if (approval.status !== 'PENDING') {
        throw new AppError(errorCodes.APPROVAL_INVALID_STATUS, { 
          approvalId, 
          currentStatus: approval.status 
        });
      }

      const now = new Date();
      const currentVersion = approval.version;
      
      const updateCount = await trx('approval_records')
        .where('id', approvalId)
        .where('version', currentVersion)
        .update({
          status: 'CANCELLED',
          version: currentVersion + 1,
          updated_at: now
        });

      if (updateCount === 0) {
        throw new AppError(errorCodes.APPROVAL_CONFLICT, { approvalId });
      }

      if (approval.budget_lock_id) {
        await this.budgetLockService.releaseLock({
          lockId: approval.budget_lock_id,
          operator,
          reason: '审批被取消'
        }, trx);
      }

      return {
        approvalId,
        status: 'CANCELLED'
      };
    });
  }
}

module.exports = ApprovalService;
