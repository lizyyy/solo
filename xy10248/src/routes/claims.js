const express = require('express');
const router = express.Router();
const claimService = require('../services/claimService');

router.post('/', (req, res) => {
  const { orderNo, userId, reason, expectedCompensation, idempotencyKey } = req.body;
  const result = claimService.createClaim({ 
    orderNo, 
    userId, 
    reason, 
    expectedCompensation,
    idempotencyKey
  });
  
  if (result.duplicate) {
    return res.status(200).json({
      ...result,
      message: '重复请求，返回已有赔付申请'
    });
  }
  
  if (result.error) {
    if (result.needsReview) {
      return res.status(202).json(result);
    }
    return res.status(400).json(result);
  }
  
  res.status(201).json(result);
});

router.get('/', (req, res) => {
  const { status, userId } = req.query;
  const result = claimService.getAllClaims({ status, userId });
  res.json(result);
});

router.get('/:claimNo', (req, res) => {
  const result = claimService.getClaimDetails(req.params.claimNo);
  
  if (result.error) {
    return res.status(404).json(result);
  }
  res.json(result);
});

router.post('/:claimNo/review', (req, res) => {
  const { action, actualCompensation, reviewNote, operator } = req.body;
  const result = claimService.reviewClaim({ 
    claimNo: req.params.claimNo, 
    action, 
    actualCompensation, 
    reviewNote,
    operator
  });
  
  if (result.error) {
    return res.status(400).json(result);
  }
  res.json(result);
});

router.post('/:claimNo/compensate', (req, res) => {
  const { idempotencyKey, operator } = req.body;
  const result = claimService.compensateClaim({ 
    claimNo: req.params.claimNo,
    idempotencyKey,
    operator
  });
  
  if (result.duplicate) {
    return res.status(200).json(result);
  }
  
  if (result.error) {
    return res.status(400).json(result);
  }
  res.json(result);
});

router.post('/:claimNo/withdraw', (req, res) => {
  const { userId, reason } = req.body;
  const result = claimService.withdrawClaim({ 
    claimNo: req.params.claimNo, 
    userId, 
    reason 
  });
  
  if (result.error) {
    return res.status(400).json(result);
  }
  res.json(result);
});

router.post('/:claimNo/correct', (req, res) => {
  const { actualCompensation, reason, operator } = req.body;
  const result = claimService.correctClaim({ 
    claimNo: req.params.claimNo, 
    actualCompensation, 
    reason,
    operator
  });
  
  if (result.error) {
    return res.status(400).json(result);
  }
  res.json(result);
});

module.exports = router;
