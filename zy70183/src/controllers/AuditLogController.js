const AuditLogService = require('../services/AuditLogService');
const ResponseUtils = require('../utils/response');
const logger = require('../utils/logger');

class AuditLogController {
  static async getLogs(req, res) {
    try {
      const result = await AuditLogService.queryLogs(req.query);
      return ResponseUtils.success(res, result);
    } catch (error) {
      logger.error('[AuditLogController.getLogs] 查询失败', error);
      return ResponseUtils.error(res, error.message || '查询失败');
    }
  }

  static async getLogsByEntity(req, res) {
    try {
      const { enterpriseCode, periodCode } = req.params;
      const result = await AuditLogService.queryLogs({
        ...req.query,
        enterpriseCode,
        periodCode
      });
      return ResponseUtils.success(res, result);
    } catch (error) {
      logger.error('[AuditLogController.getLogsByEntity] 查询失败', error);
      return ResponseUtils.error(res, error.message || '查询失败');
    }
  }
}

module.exports = AuditLogController;
