const express = require('express');
const router = express.Router();
const reportService = require('../services/reportService');
const { createResponse, asyncHandler } = require('../utils/helpers');

const getOperator = (req) => req.headers['x-operator'] || 'system';

router.post('/application/:applicationId', asyncHandler(async (req, res) => {
  const operator = getOperator(req);
  const result = await reportService.createGridReport(
    req.params.applicationId,
    req.body,
    operator
  );
  res.json(createResponse(true, result, '并网报表创建成功'));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const result = await reportService.getReportById(req.params.id);
  res.json(createResponse(true, result, '查询成功'));
}));

router.post('/:id/approve', asyncHandler(async (req, res) => {
  const operator = getOperator(req);
  const result = await reportService.approveGridReport(
    req.params.id,
    operator
  );
  res.json(createResponse(true, result, '并网报表已审批通过'));
}));

module.exports = router;
