const DeclarationService = require('../services/DeclarationService');
const ResponseUtils = require('../utils/response');
const logger = require('../utils/logger');
const { getOperatorInfo } = require('../middleware/upload');

class DeclarationController {
  static async getDeclarations(req, res) {
    try {
      const result = await DeclarationService.getDeclarations(req.query);
      return ResponseUtils.success(res, result);
    } catch (error) {
      logger.error('[DeclarationController.getDeclarations] 查询失败', error);
      return ResponseUtils.error(res, error.message || '查询失败');
    }
  }

  static async getDeclaration(req, res) {
    try {
      const { enterpriseCode, periodCode } = req.params;
      const result = await DeclarationService.getDeclarationRecord(enterpriseCode, periodCode);
      return ResponseUtils.success(res, result);
    } catch (error) {
      logger.error('[DeclarationController.getDeclaration] 查询失败', error);
      return ResponseUtils.error(res, error.message || '查询失败');
    }
  }

  static async validateDeclaration(req, res) {
    try {
      const { enterpriseCode, periodCode } = req.params;
      const operatorInfo = getOperatorInfo(req);

      const result = await DeclarationService.validateDeclaration(
        enterpriseCode,
        periodCode,
        operatorInfo
      );

      return ResponseUtils.success(res, result, result.isValid ? '校验通过，可以申报' : '校验不通过');
    } catch (error) {
      logger.error('[DeclarationController.validateDeclaration] 校验失败', error);
      return ResponseUtils.badRequest(res, error.message || '校验失败');
    }
  }

  static async submitDeclaration(req, res) {
    try {
      const { enterpriseCode, periodCode } = req.params;
      const operatorInfo = getOperatorInfo(req);

      const result = await DeclarationService.submitDeclaration(
        enterpriseCode,
        periodCode,
        operatorInfo
      );

      return ResponseUtils.success(res, result, '申报提交成功');
    } catch (error) {
      logger.error('[DeclarationController.submitDeclaration] 提交失败', error);
      return ResponseUtils.badRequest(res, error.message || '提交失败');
    }
  }

  static async manualCorrectStatus(req, res) {
    try {
      const { enterpriseCode, periodCode } = req.params;
      const { reason, targetStatus, remark } = req.body;

      if (!reason) {
        return ResponseUtils.badRequest(res, '修正原因不能为空');
      }

      if (!targetStatus) {
        return ResponseUtils.badRequest(res, '目标状态不能为空');
      }

      const operatorInfo = getOperatorInfo(req);

      const result = await DeclarationService.manualCorrectStatus(
        enterpriseCode,
        periodCode,
        { reason, targetStatus, remark },
        operatorInfo
      );

      return ResponseUtils.success(res, result, '状态修正成功');
    } catch (error) {
      logger.error('[DeclarationController.manualCorrectStatus] 修正失败', error);
      return ResponseUtils.badRequest(res, error.message || '修正失败');
    }
  }

  static async getDeclarationHistory(req, res) {
    try {
      const { enterpriseCode, periodCode } = req.params;
      const result = await DeclarationService.getDeclarationHistory(enterpriseCode, periodCode);
      return ResponseUtils.success(res, result);
    } catch (error) {
      logger.error('[DeclarationController.getDeclarationHistory] 查询失败', error);
      return ResponseUtils.error(res, error.message || '查询失败');
    }
  }

  static async generateReport(req, res) {
    try {
      const { enterpriseCode, periodCode } = req.params;
      const report = await DeclarationService.generateReport(enterpriseCode, periodCode);
      return ResponseUtils.success(res, report);
    } catch (error) {
      logger.error('[DeclarationController.generateReport] 生成报告失败', error);
      return ResponseUtils.error(res, error.message || '生成报告失败');
    }
  }

  static async getStatistics(req, res) {
    try {
      const result = await DeclarationService.getStatistics(req.query);
      return ResponseUtils.success(res, result);
    } catch (error) {
      logger.error('[DeclarationController.getStatistics] 查询失败', error);
      return ResponseUtils.error(res, error.message || '查询失败');
    }
  }
}

module.exports = DeclarationController;
