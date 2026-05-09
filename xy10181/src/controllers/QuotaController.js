const QuotaService = require('../services/QuotaService');
const logger = require('../utils/logger');

class QuotaController {
  static async applyQuota(req, res, next) {
    try {
      const reqInfo = {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
      };

      const result = await QuotaService.applyQuota(req.body, reqInfo);
      
      return res.status(201).json({
        code: 0,
        message: '审批申请提交成功',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async approve(req, res, next) {
    try {
      const { requestId } = req.params;
      const { approver, comments } = req.body;

      const reqInfo = {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
      };

      const result = await QuotaService.approveApproval(requestId, approver, comments, reqInfo);
      
      return res.status(200).json({
        code: 0,
        message: '审批通过',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async reject(req, res, next) {
    try {
      const { requestId } = req.params;
      const { approver, comments } = req.body;

      const reqInfo = {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
      };

      const result = await QuotaService.rejectApproval(requestId, approver, comments, reqInfo);
      
      return res.status(200).json({
        code: 0,
        message: '审批驳回',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async cancel(req, res, next) {
    try {
      const { requestId } = req.params;
      const { operator, comments } = req.body;

      const reqInfo = {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
      };

      const result = await QuotaService.cancelApproval(requestId, operator, comments, reqInfo);
      
      return res.status(200).json({
        code: 0,
        message: '审批撤回',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getStatus(req, res, next) {
    try {
      const { requestId } = req.params;
      const result = await QuotaService.getApprovalStatus(requestId);
      
      return res.status(200).json({
        code: 0,
        message: '查询成功',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = QuotaController;
