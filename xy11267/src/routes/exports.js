const express = require('express');
const router = express.Router();
const {
  exportToCsv,
  exportAuditLogsToCsv,
  getExportFile,
  listExportFiles
} = require('../services/exportService');
const logger = require('../utils/logger');

router.post('/records', async (req, res) => {
  try {
    const { filters, operator, role } = req.body;

    const result = await exportToCsv(filters || {});

    logger.info(`导出质检记录: ${result.count}条`, { operator, role });
    res.json({
      success: true,
      data: {
        filename: result.filename,
        count: result.count
      }
    });
  } catch (error) {
    logger.error('导出质检记录失败', { error: error.message });
    res.status(500).json({ error: '导出失败' });
  }
});

router.post('/audit-logs', async (req, res) => {
  try {
    const { filters, operator, role } = req.body;

    const result = await exportAuditLogsToCsv(filters || {});

    logger.info(`导出审计日志: ${result.count}条`, { operator, role });
    res.json({
      success: true,
      data: {
        filename: result.filename,
        count: result.count
      }
    });
  } catch (error) {
    logger.error('导出审计日志失败', { error: error.message });
    res.status(500).json({ error: '导出失败' });
  }
});

router.get('/download/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const filepath = getExportFile(filename);

    if (!filepath) {
      return res.status(404).json({ error: '文件不存在' });
    }

    res.download(filepath, filename);
  } catch (error) {
    logger.error('下载导出文件失败', { error: error.message });
    res.status(500).json({ error: '下载失败' });
  }
});

router.get('/', (req, res) => {
  try {
    const files = listExportFiles();
    res.json({ success: true, data: files });
  } catch (error) {
    logger.error('获取导出文件列表失败', { error: error.message });
    res.status(500).json({ error: '获取失败' });
  }
});

module.exports = router;
