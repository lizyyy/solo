const express = require('express');
const router = express.Router();
const reportService = require('../services/reportService');

router.post('/verify', async (req, res) => {
  try {
    const { stopId } = req.body;
    
    if (!stopId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '缺少必填字段: stopId'
        },
        actionRequired: '请提供站牌编号'
      });
    }
    
    const result = reportService.verifyStopArchive(stopId);
    
    res.json({
      success: true,
      data: result
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
