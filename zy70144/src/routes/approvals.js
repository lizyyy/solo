const express = require('express');
const approvalService = require('../services/approvalService');

const router = express.Router();

router.post('/request/:artifactId', (req, res) => {
  try {
    const { requestor, comment } = req.body;
    
    if (!requestor) {
      return res.status(400).json({ success: false, error: '缺少必要字段: requestor' });
    }

    const result = approvalService.requestApproval(req.params.artifactId, requestor, comment);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/approve/:approvalId', (req, res) => {
  try {
    const { approver, comment } = req.body;
    
    if (!approver) {
      return res.status(400).json({ success: false, error: '缺少必要字段: approver' });
    }

    const result = approvalService.approve(req.params.approvalId, approver, comment);
    res.json({ success: true, data: result });
  } catch (err) {
    if (err.message === '审批记录不存在') {
      return res.status(404).json({ success: false, error: err.message });
    }
    if (err.message.includes('无法重复操作')) {
      return res.status(409).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/reject/:approvalId', (req, res) => {
  try {
    const { approver, reason } = req.body;
    
    if (!approver) {
      return res.status(400).json({ success: false, error: '缺少必要字段: approver' });
    }

    const result = approvalService.reject(req.params.approvalId, approver, reason);
    res.json({ success: true, data: result });
  } catch (err) {
    if (err.message === '审批记录不存在') {
      return res.status(404).json({ success: false, error: err.message });
    }
    if (err.message.includes('无法重复操作')) {
      return res.status(409).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/artifact/:artifactId', (req, res) => {
  try {
    const approvals = approvalService.getApprovalsForArtifact(req.params.artifactId);
    res.json({ success: true, data: approvals });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/pending', (req, res) => {
  try {
    const approvals = approvalService.getPendingApprovals();
    res.json({ success: true, data: approvals });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:approvalId', (req, res) => {
  try {
    const approval = approvalService.getApprovalById(req.params.approvalId);
    if (!approval) {
      return res.status(404).json({ success: false, error: '审批记录不存在' });
    }
    res.json({ success: true, data: approval });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
