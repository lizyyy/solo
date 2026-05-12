const express = require('express');
const router = express.Router();
const service = require('../services/pointsService');

router.post('/', (req, res) => {
  const { memberId, orderNo, points, description } = req.body;
  const idempotentKey = req.headers['x-idempotent-key'];
  
  if (!memberId || !orderNo || !points) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_INPUT',
      message: 'memberId, orderNo, points 为必填'
    });
  }
  
  const result = service.refundPoints(memberId, orderNo, points, description, idempotentKey);
  
  if (!result.success) {
    return res.status(400).json(result);
  }
  
  res.status(201).json(result);
});

module.exports = router;
