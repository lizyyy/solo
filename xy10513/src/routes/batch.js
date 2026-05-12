const express = require('express');
const router = express.Router();
const service = require('../services/pointsService');

router.post('/issue', (req, res) => {
  const { memberId, points, sourceType, sourceRef, effectiveDate, expireDate, operator } = req.body;
  const idempotentKey = req.headers['x-idempotent-key'];
  
  if (!memberId || !points || !sourceType || !expireDate) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_INPUT',
      message: 'memberId, points, sourceType, expireDate 为必填'
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
  
  const result = service.issuePoints(
    memberId,
    points,
    sourceType,
    sourceRef,
    effectiveDate || new Date().toISOString().split('T')[0],
    expireDate,
    idempotentKey,
    operator
  );
  
  if (!result.success) {
    return res.status(400).json(result);
  }
  
  res.status(201).json(result);
});

router.get('/member/:memberId', (req, res) => {
  const { status } = req.query;
  const batches = service.getMemberBatches(req.params.memberId, status);
  
  res.json({
    success: true,
    data: {
      memberId: req.params.memberId,
      totalBatches: batches.length,
      batches
    }
  });
});

router.get('/:batchId/member/:memberId', (req, res) => {
  const batch = service.getBatchDetails(req.params.memberId, req.params.batchId);
  
  if (!batch) {
    return res.status(404).json({
      success: false,
      error: 'BATCH_NOT_FOUND',
      message: '批次不存在'
    });
  }
  
  res.json({
    success: true,
    data: batch
  });
});

router.get('/expiring-soon/:memberId', (req, res) => {
  const { days = 30 } = req.query;
  const batches = service.getExpiringSoon(req.params.memberId, parseInt(days));
  
  res.json({
    success: true,
    data: {
      memberId: req.params.memberId,
      days,
      totalPoints: batches.reduce((sum, b) => sum + b.available_points, 0),
      batches
    }
  });
});

module.exports = router;
