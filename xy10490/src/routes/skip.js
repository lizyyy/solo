const express = require('express');
const router = express.Router();
const SkipRequestService = require('../services/SkipRequestService');
const { asyncHandler } = require('../middleware/error');
const { skipRequestSchema, approveSkipSchema, validate } = require('../middleware/validator');

router.post('/plan/:planId', validate(skipRequestSchema), asyncHandler(async (req, res) => {
  const request = await SkipRequestService.createSkipRequest(req.params.planId, req.body);
  res.status(201).json({
    success: true,
    message: '跳过申请已创建，等待审批',
    data: request
  });
}));

router.post('/:requestId/approve', validate(approveSkipSchema), asyncHandler(async (req, res) => {
  const result = await SkipRequestService.approveSkipRequest(req.params.requestId, req.body);
  res.json({
    success: true,
    message: '跳过申请已批准，保养计划已跳过',
    data: result
  });
}));

router.post('/:requestId/reject', validate(approveSkipSchema), asyncHandler(async (req, res) => {
  const request = await SkipRequestService.rejectSkipRequest(req.params.requestId, req.body);
  res.json({
    success: true,
    message: '跳过申请已拒绝',
    data: request
  });
}));

router.get('/pending', asyncHandler(async (req, res) => {
  const requests = await SkipRequestService.getPendingRequests();
  res.json({
    success: true,
    data: requests
  });
}));

router.get('/:requestId', asyncHandler(async (req, res) => {
  const request = await SkipRequestService.getRequestById(req.params.requestId);
  res.json({
    success: true,
    data: request
  });
}));

module.exports = router;
