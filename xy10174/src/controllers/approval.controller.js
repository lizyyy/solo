const { success, error, errorCodes } = require('../utils/response');
const ApprovalService = require('../services/approval.service');
const BudgetLockService = require('../services/budget-lock.service');

class ApprovalController {
  constructor() {
    this.service = new ApprovalService();
    this.budgetLockService = new BudgetLockService();
  }

  async createApproval(req, res) {
    try {
      const { 
        applicationId, 
        budgetLockId, 
        currentApprover, 
        approvalLevel,
        operator 
      } = req.body;

      if (!applicationId) {
        return res.status(400).json(error(errorCodes.VALIDATION_ERROR, {
          missingFields: ['applicationId']
        }));
      }

      let actualLockId = budgetLockId;
      if (!actualLockId) {
        const lock = await this.budgetLockService.getLockByApplicationId(applicationId);
        if (lock) {
          actualLockId = lock.id;
        }
      }

      const result = await this.service.createApproval({
        applicationId,
        budgetLockId: actualLockId,
        currentApprover,
        approvalLevel,
        operator: operator || 'system'
      });

      res.json(success(result, '审批创建成功'));
    } catch (err) {
      console.error('Create approval error:', err);
      res.status(500).json(error(errorCodes.INTERNAL_ERROR, err.message));
    }
  }

  async getApproval(req, res) {
    try {
      const { approvalId } = req.params;
      const approval = await this.service.getApprovalById(approvalId);
      
      if (!approval) {
        return res.status(404).json(error(errorCodes.APPROVAL_NOT_FOUND, { approvalId }));
      }
      
      res.json(success(approval));
    } catch (err) {
      console.error('Get approval error:', err);
      res.status(500).json(error(errorCodes.INTERNAL_ERROR, err.message));
    }
  }

  async getApprovalByApplication(req, res) {
    try {
      const { applicationId } = req.params;
      const approval = await this.service.getApprovalByApplicationId(applicationId);
      
      if (!approval) {
        return res.status(404).json(error(errorCodes.APPROVAL_NOT_FOUND, { applicationId }));
      }
      
      res.json(success(approval));
    } catch (err) {
      console.error('Get approval by application error:', err);
      res.status(500).json(error(errorCodes.INTERNAL_ERROR, err.message));
    }
  }

  async approve(req, res) {
    try {
      const { approvalId } = req.params;
      const { approvedBy, operator } = req.body;

      if (!approvalId || !approvedBy) {
        return res.status(400).json(error(errorCodes.VALIDATION_ERROR, {
          missingFields: ['approvalId', 'approvedBy'].filter(f => !approvalId || !approvedBy)
        }));
      }

      const result = await this.service.approve({
        approvalId,
        approvedBy,
        operator: operator || approvedBy
      });

      res.json(success(result, '审批通过'));
    } catch (err) {
      console.error('Approve error:', err);
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

  async reject(req, res) {
    try {
      const { approvalId } = req.params;
      const { rejectReason, operator } = req.body;

      if (!approvalId) {
        return res.status(400).json(error(errorCodes.VALIDATION_ERROR, {
          missingFields: ['approvalId']
        }));
      }

      const result = await this.service.reject({
        approvalId,
        rejectReason: rejectReason || '未提供拒绝原因',
        operator: operator || 'system'
      });

      res.json(success(result, '审批已拒绝'));
    } catch (err) {
      console.error('Reject error:', err);
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

  async cancel(req, res) {
    try {
      const { approvalId } = req.params;
      const { operator } = req.body;

      if (!approvalId) {
        return res.status(400).json(error(errorCodes.VALIDATION_ERROR, {
          missingFields: ['approvalId']
        }));
      }

      const result = await this.service.cancel({
        approvalId,
        operator: operator || 'system'
      });

      res.json(success(result, '审批已取消'));
    } catch (err) {
      console.error('Cancel error:', err);
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
}

module.exports = ApprovalController;
