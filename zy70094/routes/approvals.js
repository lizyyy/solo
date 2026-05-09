const express = require('express');
const router = express.Router();
const approvalService = require('../services/approvalService');
const { createResponse, asyncHandler } = require('../utils/helpers');

const getOperator = (req) => req.headers['x-operator'] || 'system';

router.post('/application/:applicationId/flow', asyncHandler(async (req, res) => {
  const operator = getOperator(req);
  const result = await approvalService.createApprovalFlow(
    req.params.applicationId,
    operator
  );
  res.json(createResponse(true, result, '审批流程创建成功'));
}));

router.post('/application/:applicationId/restart', asyncHandler(async (req, res) => {
  const operator = getOperator(req);
  const result = await approvalService.restartApprovalFlow(
    req.params.applicationId,
    operator
  );
  res.json(createResponse(true, result, '审批流程重置成功'));
}));

router.get('/application/:applicationId/current', asyncHandler(async (req, res) => {
  const result = await approvalService.getCurrentApprovalNode(req.params.applicationId);
  res.json(createResponse(true, result, '查询成功'));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const result = await approvalService.getApprovalById(req.params.id);
  res.json(createResponse(true, result, '查询成功'));
}));

router.post('/:id/review', asyncHandler(async (req, res) => {
  const operator = getOperator(req);
  const { result, approver, remark } = req.body;
  const approvalResult = await approvalService.reviewApproval(
    req.params.id,
    result,
    approver,
    remark,
    operator
  );
  res.json(createResponse(true, approvalResult, '审批完成'));
}));

module.exports = router;
