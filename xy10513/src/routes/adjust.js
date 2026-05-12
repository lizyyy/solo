const express = require('express');
const router = express.Router();
const service = require('../services/pointsService');

router.post('/', (req, res) => {
  const { memberId, batchId, newAvailable, reason, operator } = req.body;
  
  if (!memberId || !batchId || newAvailable === undefined || !reason || !operator) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_INPUT',
      message: 'memberId, batchId, newAvailable, reason, operator 为必填'
    });
  }
  
  const result = service.adjustPoints(memberId, batchId, newAvailable, reason, operator);
  
  if (!result.success) {
    return res.status(400).json(result);
  }
  
  res.status(201).json(result);
});

module.exports = router;
