const express = require('express');
const router = express.Router();
const service = require('../services/pointsService');

router.post('/process', (req, res) => {
  const { executeDate } = req.body;
  const idempotentKey = req.headers['x-idempotent-key'];
  
  if (!executeDate) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_INPUT',
      message: 'executeDate 为必填 (格式: YYYY-MM-DD)'
    });
  }
  
  const result = service.processExpire(executeDate, idempotentKey);
  res.json(result);
});

module.exports = router;
