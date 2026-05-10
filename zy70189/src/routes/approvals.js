const express = require('express');
const router = express.Router();
const approvalService = require('../services/approvalService');
const permissionService = require('../services/permissionService');
const logger = require('../logger');

router.get('/pending', (req, res) => {
  try {
    const filters = {
      approver_level: req.query.approver_level,
      page: parseInt(req.query.page) || 1,
      page_size: parseInt(req.query.page_size) || 50
    };

    const result = approvalService.listPendingApprovals(filters);
    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    logger.error('查询待审批列表失败', { error: err.message });
    res.status(500).json({
      success: false,
      error: '查询待审批列表失败',
      detail: err.message
    });
  }
});

router.get('/:approvalId', (req, res) => {
  try {
    const approval = approvalService.getApprovalById(req.params.approvalId);
    if (!approval) {
      return res.status(404).json({
        success: false,
        error: '审批请求不存在'
      });
    }
    res.json({
      success: true,
      data: approval
    });
  } catch (err) {
    logger.error('查询审批失败', { error: err.message });
    res.status(500).json({
      success: false,
      error: '查询审批失败',
      detail: err.message
    });
  }
});

router.post('/:approvalId/approve', (req, res) => {
  try {
    const { comment } = req.body;
    const approverId = req.headers['x-operator-id'];

    if (!approverId) {
      return res.status(400).json({
        success: false,
        error: '缺少操作人ID: X-Operator-Id'
      });
    }

    const approverStaff = permissionService.getStaffById(approverId);
    if (!approverStaff) {
      return res.status(400).json({
        success: false,
        error: '操作人不存在'
      });
    }

    const result = approvalService.approve(req.params.approvalId, approverStaff, comment);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err) {
    logger.error('审批通过失败', { error: err.message });
    res.status(500).json({
      success: false,
      error: '审批通过失败',
      detail: err.message
    });
  }
});

router.post('/:approvalId/reject', (req, res) => {
  try {
    const { comment } = req.body;
    const approverId = req.headers['x-operator-id'];

    if (!approverId) {
      return res.status(400).json({
        success: false,
        error: '缺少操作人ID: X-Operator-Id'
      });
    }

    const approverStaff = permissionService.getStaffById(approverId);
    if (!approverStaff) {
      return res.status(400).json({
        success: false,
        error: '操作人不存在'
      });
    }

    const result = approvalService.reject(req.params.approvalId, approverStaff, comment);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err) {
    logger.error('审批拒绝失败', { error: err.message });
    res.status(500).json({
      success: false,
      error: '审批拒绝失败',
      detail: err.message
    });
  }
});

router.post('/:approvalId/escalate', (req, res) => {
  try {
    const { new_level, reason } = req.body;
    const approverId = req.headers['x-operator-id'];

    if (!approverId) {
      return res.status(400).json({
        success: false,
        error: '缺少操作人ID: X-Operator-Id'
      });
    }

    if (!new_level) {
      return res.status(400).json({
        success: false,
        error: '缺少目标等级: new_level'
      });
    }

    const approverStaff = permissionService.getStaffById(approverId);
    if (!approverStaff) {
      return res.status(400).json({
        success: false,
        error: '操作人不存在'
      });
    }

    const result = approvalService.escalateApproval(req.params.approvalId, approverStaff, new_level, reason);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err) {
    logger.error('升级审批失败', { error: err.message });
    res.status(500).json({
      success: false,
      error: '升级审批失败',
      detail: err.message
    });
  }
});

module.exports = router;
