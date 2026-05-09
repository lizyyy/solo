const express = require('express');
const router = express.Router();
const applicationService = require('../services/applicationService');
const surveyService = require('../services/surveyService');
const approvalService = require('../services/approvalService');
const meterService = require('../services/meterService');
const supplementService = require('../services/supplementService');
const reportService = require('../services/reportService');
const logService = require('../services/logService');
const { createResponse, asyncHandler } = require('../utils/helpers');

const getOperator = (req) => req.headers['x-operator'] || 'system';

router.post('/', asyncHandler(async (req, res) => {
  const operator = getOperator(req);
  const result = await applicationService.createApplication(req.body, operator);
  res.json(createResponse(true, result, '申请单创建成功'));
}));

router.get('/', asyncHandler(async (req, res) => {
  const { status, limit = 100, offset = 0 } = req.query;
  const result = await applicationService.getAllApplications(
    status,
    parseInt(limit),
    parseInt(offset)
  );
  res.json(createResponse(true, result, '查询成功'));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const result = await applicationService.getApplicationById(req.params.id);
  res.json(createResponse(true, result, '查询成功'));
}));

router.get('/:id/summary', asyncHandler(async (req, res) => {
  const result = await applicationService.getApplicationSummary(req.params.id);
  res.json(createResponse(true, result, '查询成功'));
}));

router.get('/:id/surveys', asyncHandler(async (req, res) => {
  const result = await surveyService.getSurveysByApplication(req.params.id);
  res.json(createResponse(true, result, '查询成功'));
}));

router.get('/:id/approvals', asyncHandler(async (req, res) => {
  const result = await approvalService.getApprovalsByApplication(req.params.id);
  res.json(createResponse(true, result, '查询成功'));
}));

router.get('/:id/meters', asyncHandler(async (req, res) => {
  const result = await meterService.getMeterTasksByApplication(req.params.id);
  res.json(createResponse(true, result, '查询成功'));
}));

router.get('/:id/supplements', asyncHandler(async (req, res) => {
  const result = await supplementService.getSupplementsByApplication(req.params.id);
  res.json(createResponse(true, result, '查询成功'));
}));

router.get('/:id/reports', asyncHandler(async (req, res) => {
  const result = await reportService.getReportsByApplication(req.params.id);
  res.json(createResponse(true, result, '查询成功'));
}));

router.get('/:id/logs', asyncHandler(async (req, res) => {
  const result = await logService.getLogsByApplication(req.params.id);
  res.json(createResponse(true, result, '查询成功'));
}));

router.patch('/:id/status', asyncHandler(async (req, res) => {
  const operator = getOperator(req);
  const { new_status, remark, force = false } = req.body;
  const result = await applicationService.updateApplicationStatus(
    req.params.id,
    new_status,
    operator,
    remark,
    force
  );
  res.json(createResponse(true, result, '状态更新成功'));
}));

router.patch('/:id/correct', asyncHandler(async (req, res) => {
  const operator = getOperator(req);
  const result = await applicationService.manualCorrectApplication(
    req.params.id,
    req.body,
    operator
  );
  res.json(createResponse(true, result, '人工修正成功'));
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const operator = getOperator(req);
  const result = await applicationService.deleteApplication(req.params.id, operator);
  res.json(createResponse(true, result, '删除成功'));
}));

module.exports = router;
