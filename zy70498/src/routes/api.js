const express = require('express');
const router = express.Router();
const scoringService = require('../services/scoringService');
const exportService = require('../services/exportService');

router.post('/score', async (req, res) => {
  try {
    const result = await scoringService.performScoring(req.body);
    res.json(result);
  } catch (error) {
    console.error('评分处理错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/record/:batchId', async (req, res) => {
  try {
    const record = await scoringService.getScoringRecord(req.params.batchId);
    if (!record) {
      return res.status(404).json({ error: '记录未找到' });
    }
    res.json(record);
  } catch (error) {
    console.error('查询记录错误:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/records', async (req, res) => {
  try {
    const records = await scoringService.getAllRecords(req.query);
    res.json({
      count: records.length,
      data: records
    });
  } catch (error) {
    console.error('查询记录列表错误:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/samples', async (req, res) => {
  try {
    const samples = await scoringService.getReviewSamples();
    res.json({
      count: samples.length,
      data: samples
    });
  } catch (error) {
    console.error('查询样本错误:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/export', async (req, res) => {
  try {
    const result = await exportService.exportRecordsToCSV(req.query);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('导出错误:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/export/exceptions', async (req, res) => {
  try {
    const result = await exportService.exportExceptionRecordsWithDetails();
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('导出异常记录错误:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/export/files', async (req, res) => {
  try {
    const files = await exportService.getExportFiles();
    res.json({
      count: files.length,
      data: files
    });
  } catch (error) {
    console.error('获取导出文件列表错误:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/report/:batchId', async (req, res) => {
  try {
    const report = await exportService.getExportDetailedReport(req.params.batchId);
    if (!report) {
      return res.status(404).json({ error: '报告未找到' });
    }
    res.json(report);
  } catch (error) {
    console.error('生成详细报告错误:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
