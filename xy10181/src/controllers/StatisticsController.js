const StatisticsService = require('../services/StatisticsService');
const logger = require('../utils/logger');

class StatisticsController {
  static async getSummary(req, res, next) {
    try {
      const result = await StatisticsService.getQuotaSummary();
      
      return res.status(200).json({
        code: 0,
        message: '查询成功',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async verifyConsistency(req, res, next) {
    try {
      const result = await StatisticsService.verifyConsistency();
      
      return res.status(200).json({
        code: 0,
        message: result.consistent ? '数据一致性校验通过' : '发现数据不一致',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAuditLogs(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 100;
      const result = await StatisticsService.getAuditLogs(Math.min(limit, 500));
      
      return res.status(200).json({
        code: 0,
        message: '查询成功',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getQuotaOperations(req, res, next) {
    try {
      const { quotaCode } = req.params;
      const limit = parseInt(req.query.limit) || 100;
      const result = await StatisticsService.getQuotaOperations(quotaCode, Math.min(limit, 500));
      
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

module.exports = StatisticsController;
