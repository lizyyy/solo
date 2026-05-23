const QueueService = require('../services/queueService');
const logger = require('../config/logger');

class QueueController {
  static async addJob(req, res) {
    try {
      const { jobType, payload, maxRetryCount } = req.body;
      
      if (!jobType) {
        return res.status(400).json({ error: '请指定任务类型' });
      }

      const validTypes = ['loss_calculation', 'bad_fruit_deduction', 'secondary_sorting', 'duplicate_check', 'compensation', 'external_receipt'];
      if (!validTypes.includes(jobType)) {
        return res.status(400).json({ error: '无效的任务类型', validTypes });
      }

      const queueItem = await QueueService.addJob(jobType, payload || {}, { maxRetryCount });

      res.json({ success: true, data: queueItem });
    } catch (error) {
      logger.error('添加任务失败:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async getJob(req, res) {
    try {
      const { queueId } = req.params;
      const { CompensationQueue } = require('../models');
      
      const job = await CompensationQueue.findByPk(queueId, {
        include: [{ association: 'lossRecord' }],
      });
      
      if (!job) {
        return res.status(404).json({ error: '任务不存在' });
      }

      res.json({ success: true, data: job });
    } catch (error) {
      logger.error('获取任务失败:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async listJobs(req, res) {
    try {
      const result = await QueueService.listJobs(req.query);
      res.json({
        success: true,
        data: {
          list: result.rows,
          total: result.count,
          page: parseInt(req.query.page) || 1,
          pageSize: parseInt(req.query.pageSize) || 20,
        },
      });
    } catch (error) {
      logger.error('获取任务列表失败:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async getStats(req, res) {
    try {
      const stats = await QueueService.getQueueStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      logger.error('获取统计失败:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async manualHandle(req, res) {
    try {
      const { queueId } = req.params;
      const { handledBy, handleNote, action } = req.body;
      
      if (!action) {
        return res.status(400).json({ error: '请指定操作类型' });
      }

      const validActions = ['retry', 'close', 'compensate'];
      if (!validActions.includes(action)) {
        return res.status(400).json({ error: '无效的操作', validActions });
      }

      const result = await QueueService.manualHandle(
        queueId,
        handledBy || 'admin',
        handleNote || '',
        action
      );

      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('人工处理失败:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async submitReceipt(req, res) {
    try {
      const { queueId } = req.params;
      const { receiptId, receiptData } = req.body;
      
      if (!receiptId) {
        return res.status(400).json({ error: '请提供回执ID' });
      }

      const result = await QueueService.submitExternalReceipt(queueId, receiptId, receiptData || {});

      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('提交回执失败:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async markWaitingManual(req, res) {
    try {
      const { queueId } = req.params;
      const { handleNote } = req.body;

      const result = await QueueService.markWaitingManual(queueId, handleNote);

      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('标记人工处理失败:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = QueueController;
