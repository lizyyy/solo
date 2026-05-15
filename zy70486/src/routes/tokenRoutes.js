const express = require('express');
const { tokenService } = require('../services/tokenService');
const {
  validateIssue,
  validateVerify,
  validateExecute,
  validateRevoke
} = require('../middleware/validate');

const router = express.Router();

router.post('/issue', validateIssue, (req, res) => {
  const result = tokenService.issueToken(req.body);
  if (result.success) {
    res.status(201).json(result);
  } else {
    res.status(400).json(result);
  }
});

router.post('/verify', validateVerify, (req, res) => {
  const { tokenId, operatorId, operatorName, requestScope } = req.body;
  const result = tokenService.verifyToken(tokenId, operatorId, operatorName, requestScope);
  if (result.success) {
    res.json(result);
  } else {
    res.status(403).json(result);
  }
});

router.post('/execute', validateExecute, (req, res) => {
  const { tokenId, operatorId, operatorName, requestScope } = req.body;
  const result = tokenService.executeToken(tokenId, operatorId, operatorName, requestScope);
  if (result.success) {
    res.json(result);
  } else {
    res.status(403).json(result);
  }
});

router.post('/revoke', validateRevoke, (req, res) => {
  const { tokenId, reason, operatorId, operatorName } = req.body;
  const result = tokenService.revokeToken(tokenId, reason, operatorId, operatorName);
  if (result.success) {
    res.json(result);
  } else {
    res.status(403).json(result);
  }
});

router.get('/audit/:tokenId', (req, res) => {
  const { tokenId } = req.params;
  const result = tokenService.getTokenAudit(tokenId);
  if (result.success) {
    res.json(result);
  } else {
    res.status(404).json(result);
  }
});

router.get('/audit/operator/:operatorId', (req, res) => {
  const { operatorId } = req.params;
  const result = tokenService.getAuditByOperator(operatorId);
  res.json(result);
});

router.get('/audit', (req, res) => {
  const result = tokenService.getAllAudit();
  res.json(result);
});

router.get('/batch/:batchId', (req, res) => {
  const { batchId } = req.params;
  const result = tokenService.getTokensByBatch(batchId);
  res.json(result);
});

module.exports = router;
