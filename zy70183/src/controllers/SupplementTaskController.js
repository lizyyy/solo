const SupplementTaskService = require('../services/SupplementTaskService');
const ResponseUtils = require('../utils/response');
const logger = require('../utils/logger');
const { getOperatorInfo } = require('../middleware/upload');

class SupplementTaskController {
  static async createFromDeclaration(req, res) {
    try {
      const { enterpriseCode, periodCode } = req.body;

      if (!enterpriseCode || !periodCode) {
        return ResponseUtils.badRequest(res, '企业代码和申报期不能为空');
      }

      const operatorInfo = getOperatorInfo(req);

      const task = await SupplementTaskService.createFromDeclaration(
        enterpriseCode,
        periodCode,
        operatorInfo
      );

      return ResponseUtils.success(res, task, '补传任务创建成功');
    } catch (error) {
      logger.error('[SupplementTaskController.createFromDeclaration] 创建失败', error);
      return ResponseUtils.badRequest(res, error.message || '创建失败');
    }
  }

  static async createManualTask(req, res) {
    try {
      const operatorInfo = getOperatorInfo(req);
      const task = await SupplementTaskService.createManualTask(req.body, operatorInfo);
      return ResponseUtils.success(res, task, '补传任务创建成功');
    } catch (error) {
      logger.error('[SupplementTaskController.createManualTask] 创建失败', error);
      return ResponseUtils.badRequest(res, error.message || '创建失败');
    }
  }

  static async getTasks(req, res) {
    try {
      const result = await SupplementTaskService.getTasks(req.query);
      return ResponseUtils.success(res, result);
    } catch (error) {
      logger.error('[SupplementTaskController.getTasks] 查询失败', error);
      return ResponseUtils.error(res, error.message || '查询失败');
    }
  }

  static async getTaskById(req, res) {
    try {
      const { taskId } = req.params;
      const task = await SupplementTaskService.getTaskById(taskId);
      return ResponseUtils.success(res, task);
    } catch (error) {
      logger.error('[SupplementTaskController.getTaskById] 查询失败', error);
      return ResponseUtils.notFound(res, error.message || '任务不存在');
    }
  }

  static async startTask(req, res) {
    try {
      const { taskId } = req.params;
      const operatorInfo = getOperatorInfo(req);

      const task = await SupplementTaskService.updateTaskStatus(taskId, 'IN_PROGRESS', operatorInfo);
      return ResponseUtils.success(res, task, '任务已开始');
    } catch (error) {
      logger.error('[SupplementTaskController.startTask] 操作失败', error);
      return ResponseUtils.badRequest(res, error.message || '操作失败');
    }
  }

  static async completeTask(req, res) {
    try {
      const { taskId } = req.params;
      const operatorInfo = getOperatorInfo(req);

      const task = await SupplementTaskService.updateTaskStatus(taskId, 'COMPLETED', operatorInfo);
      return ResponseUtils.success(res, task, '任务已完成');
    } catch (error) {
      logger.error('[SupplementTaskController.completeTask] 操作失败', error);
      return ResponseUtils.badRequest(res, error.message || '操作失败');
    }
  }

  static async cancelTask(req, res) {
    try {
      const { taskId } = req.params;
      const operatorInfo = getOperatorInfo(req);

      const task = await SupplementTaskService.updateTaskStatus(taskId, 'CANCELLED', operatorInfo);
      return ResponseUtils.success(res, task, '任务已取消');
    } catch (error) {
      logger.error('[SupplementTaskController.cancelTask] 操作失败', error);
      return ResponseUtils.badRequest(res, error.message || '操作失败');
    }
  }

  static async checkTaskCompletion(req, res) {
    try {
      const { taskId } = req.params;
      const operatorInfo = getOperatorInfo(req);

      const result = await SupplementTaskService.checkTaskCompletion(taskId, operatorInfo);
      return ResponseUtils.success(res, result);
    } catch (error) {
      logger.error('[SupplementTaskController.checkTaskCompletion] 查询失败', error);
      return ResponseUtils.error(res, error.message || '查询失败');
    }
  }

  static async getStatistics(req, res) {
    try {
      const result = await SupplementTaskService.getStatistics(req.query);
      return ResponseUtils.success(res, result);
    } catch (error) {
      logger.error('[SupplementTaskController.getStatistics] 查询失败', error);
      return ResponseUtils.error(res, error.message || '查询失败');
    }
  }
}

module.exports = SupplementTaskController;
