const ExportService = require('../services/exportService');
const logger = require('../config/logger');
const fs = require('fs');

class ExportController {
  static async exportRetryable(req, res) {
    try {
      const result = await ExportService.exportRetryable(req.query);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('导出可重试任务失败:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async exportDeadLetter(req, res) {
    try {
      const result = await ExportService.exportDeadLetter(req.query);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('导出死信任务失败:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async exportQueueByStatus(req, res) {
    try {
      const { status } = req.params;
      const result = await ExportService.exportQueueByStatus(status, req.query);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('导出队列数据失败:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async exportLossRecords(req, res) {
    try {
      const result = await ExportService.exportLossRecords(req.query);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('导出损耗记录失败:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async exportImportBatches(req, res) {
    try {
      const result = await ExportService.exportImportBatches(req.query);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('导出导入批次失败:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async downloadFile(req, res) {
    try {
      const { fileName } = req.params;
      const config = require('../config');
      const filePath = require('path').join(config.export.dir, fileName);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: '文件不存在' });
      }

      res.download(filePath, fileName);
    } catch (error) {
      logger.error('下载文件失败:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = ExportController;
