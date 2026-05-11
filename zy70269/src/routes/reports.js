const express = require('express');
const router = express.Router();
const reportService = require('../services/reportService');

router.post('/', async (req, res) => {
  try {
    const result = reportService.createReport(req.body);
    
    const isMerged = result.processingResult === 'MERGED';
    const statusCode = isMerged ? 202 : 201;
    
    res.status(statusCode).json({
      success: true,
      data: result,
      acceptance: isMerged 
        ? { status: 'MERGED', message: '系统检测到重复派修单，已自动合并' }
        : { status: 'ACCEPTED', message: '上报已受理并生成派修单' }
    });
  } catch (err) {
    if (err.isBusinessError) {
      res.status(400).json(err.toResponse());
    } else {
      console.error(err);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '内部错误'
        },
        actionRequired: '请联系技术支持'
      });
    }
  }
});

router.get('/:reportId', async (req, res) => {
  try {
    const result = reportService.getReport(req.params.reportId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    if (err.isBusinessError) {
      res.status(404).json(err.toResponse());
    } else {
      console.error(err);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '内部错误'
        }
      });
    }
  }
});

router.post('/:reportId/retry', async (req, res) => {
  try {
    const result = reportService.retryReport(req.params.reportId, req.body);
    
    res.json({
      success: true,
      data: result,
      retryResult: {
        status: 'SUCCESS',
        message: '重试成功，已生成派修单'
      }
    });
  } catch (err) {
    if (err.isBusinessError) {
      res.status(400).json(err.toResponse());
    } else {
      console.error(err);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '内部错误'
        }
      });
    }
  }
});

module.exports = router;
