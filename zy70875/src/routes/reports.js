const express = require('express');
const fs = require('fs');
const router = express.Router();
const { generateCSVReport, generateReportData, getReportFilePath } = require('../services/reportService');

router.get('/:batchId', async (req, res) => {
  try {
    const data = await generateReportData(req.params.batchId);
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
});

router.get('/:batchId/download', async (req, res) => {
  try {
    const operator = req.query.operator || 'system';
    const report = await generateCSVReport(req.params.batchId, operator);
    
    const filePath = getReportFilePath(report.fileName);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: '报告文件不存在'
      });
    }
    
    res.download(filePath, report.fileName, (err) => {
      if (err) {
        res.status(500).json({
          error: '下载失败'
        });
      }
    });
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
});

module.exports = router;
