const express = require('express');
const { ApiResponse } = require('../utils/response');
const ReturnApprovalService = require('../services/returnApprovalService');
const { authenticate, requireRoles } = require('../middleware/auth');
const { idempotent } = require('../middleware/idempotent');

const router = express.Router();

router.post('/apply/:seizedItemId', authenticate, idempotent(), async (req, res, next) => {
  try {
    const approval = await ReturnApprovalService.applyForReturn(req, req.params.seizedItemId, req.body);
    res.status(201).json(ApiResponse.success(approval, '退还申请提交成功，等待审批'));
  } catch (error) {
    next(error);
  }
});

router.post('/approve/:approvalId', authenticate, requireRoles('supervisor', 'admin'), async (req, res, next) => {
  try {
    const result = await ReturnApprovalService.approveReturn(req, req.params.approvalId, req.body);
    res.json(ApiResponse.success(result, '审批通过'));
  } catch (error) {
    next(error);
  }
});

router.post('/reject/:approvalId', authenticate, requireRoles('supervisor', 'admin'), async (req, res, next) => {
  try {
    const result = await ReturnApprovalService.rejectReturn(req, req.params.approvalId, req.body);
    res.json(ApiResponse.success(result, '已拒绝退还申请'));
  } catch (error) {
    next(error);
  }
});

router.post('/execute/:approvalId', authenticate, async (req, res, next) => {
  try {
    const result = await ReturnApprovalService.executeReturn(req, req.params.approvalId);
    res.json(ApiResponse.success(result, '退还执行成功'));
  } catch (error) {
    next(error);
  }
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { 
      approval_number, approval_status, seized_item_id,
      applicant, start_date, end_date,
      page = 1, page_size = 20 
    } = req.query;

    const result = await ReturnApprovalService.list(
      {
        approval_number,
        approval_status,
        seized_item_id,
        applicant,
        start_date,
        end_date
      },
      parseInt(page),
      parseInt(page_size)
    );

    res.json(ApiResponse.pagination(result.approvals, result.total, page, page_size));
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const approval = await ReturnApprovalService.getById(req.params.id);
    res.json(ApiResponse.success(approval));
  } catch (error) {
    next(error);
  }
});

router.get('/item/:seizedItemId', authenticate, async (req, res, next) => {
  try {
    const approvals = await ReturnApprovalService.getByItemId(req.params.seizedItemId);
    res.json(ApiResponse.success(approvals));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
