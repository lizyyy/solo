const { Task } = require('../models');
const shortLinkAccessService = require('../services/shortLinkAccessService');
const { processPendingConversions, generateAttributionReport } = require('../services/attributionService');
const logger = require('../utils/logger');

class TaskController {
  async rerunTask(req, res) {
    try {
      const { taskId } = req.params;
      
      const result = await shortLinkAccessService.rerunFailedTask(taskId);
      
      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Error rerunning task', {
        taskId: req.params.taskId,
        error: error.message,
      });
      
      return res.status(500).json({
        success: false,
        error: 'rerun_failed',
        message: error.message,
      });
    }
  }

  async rerunAllFailed(req, res) {
    try {
      const results = await shortLinkAccessService.rerunAllFailed();
      
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      
      return res.json({
        success: true,
        data: {
          total: results.length,
          success: successCount,
          failed: failCount,
          results,
        },
      });
    } catch (error) {
      logger.error('Error rerunning all failed tasks', {
        error: error.message,
      });
      
      return res.status(500).json({
        success: false,
        error: 'rerun_failed',
        message: error.message,
      });
    }
  }

  async listFailedTasks(req, res) {
    try {
      const { limit = 100, offset = 0, type } = req.query;
      
      const where = { status: 'failed' };
      if (type) where.type = type;
      
      const tasks = await Task.findAndCountAll({
        where,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']],
      });
      
      return res.json({
        success: true,
        data: tasks,
      });
    } catch (error) {
      logger.error('Error listing failed tasks', {
        error: error.message,
      });
      
      return res.status(500).json({
        success: false,
        error: 'list_failed',
        message: error.message,
      });
    }
  }

  async processPendingConversions(req, res) {
    try {
      const results = await processPendingConversions();
      
      return res.json({
        success: true,
        data: {
          total: results.length,
          results,
        },
      });
    } catch (error) {
      logger.error('Error processing pending conversions', {
        error: error.message,
      });
      
      return res.status(500).json({
        success: false,
        error: 'processing_failed',
        message: error.message,
      });
    }
  }

  async generateReport(req, res) {
    try {
      const { shortCode, reportDate } = req.body;
      
      if (!shortCode || !reportDate) {
        return res.status(400).json({
          success: false,
          error: 'missing_params',
          message: 'shortCode and reportDate are required',
        });
      }
      
      const { ShortLink } = require('../models');
      const shortLink = await ShortLink.findOne({ where: { shortCode } });
      
      if (!shortLink) {
        return res.status(404).json({
          success: false,
          error: 'short_link_not_found',
        });
      }
      
      const report = await generateAttributionReport(
        new Date(reportDate),
        shortLink.id
      );
      
      return res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      logger.error('Error generating report', {
        error: error.message,
      });
      
      return res.status(500).json({
        success: false,
        error: 'report_failed',
        message: error.message,
      });
    }
  }
}

module.exports = new TaskController();
