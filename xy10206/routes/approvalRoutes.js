const express = require('express');
const router = express.Router();
const approvalService = require('../services/approvalService');

router.get('/', (req, res, next) => {
  try {
    const approvals = approvalService.getAllApprovals(req.query.sceneId);
    res.json({
      success: true,
      data: approvals,
      total: approvals.length
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:approvalId', (req, res, next) => {
  try {
    const approval = approvalService.getApprovalById(req.params.approvalId);
    res.json({
      success: true,
      data: approval
    });
  } catch (err) {
    next(err);
  }
});

router.post('/submit', (req, res, next) => {
  try {
    const result = approvalService.submitForApproval(req.body);
    res.status(201).json({
      success: true,
      data: {
        approval: result.approval,
        preset: result.preset
      },
      message: result.message
    });
  } catch (err) {
    next(err);
  }
});

router.post('/decide', (req, res, next) => {
  try {
    const result = approvalService.makeApprovalDecision(req.body);
    res.json({
      success: true,
      data: {
        approval: result.approval,
        preset: result.preset
      },
      message: result.message
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
