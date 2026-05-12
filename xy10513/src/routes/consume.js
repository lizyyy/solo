const express = require('express');
const router = express.Router();
const service = require('../services/pointsService');

router.post('/', (req, res) => {
  const { memberId, points, orderNo, description } = req.body;
  const idempotentKey = req.headers['x-idempotent-key'];
  
  if (!memberId || !points || !orderNo) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_INPUT',
      message: 'memberId, points, orderNo 为必填'
    });
  }
  
  const member = service.getMember(memberId);
  if (!member) {
    return res.status(404).json({
      success: false,
      error: 'MEMBER_NOT_FOUND',
      message: '会员不存在'
    });
  }
  
  const result = service.consumePoints(memberId, points, orderNo, description, idempotentKey);
  
  if (!result.success) {
    return res.status(400).json(result);
  }
  
  res.status(201).json(result);
});

module.exports = router;
