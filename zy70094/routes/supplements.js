const express = require('express');
const router = express.Router();
const supplementService = require('../services/supplementService');
const { createResponse, asyncHandler } = require('../utils/helpers');

const getOperator = (req) => req.headers['x-operator'] || 'system';

router.post('/application/:applicationId', asyncHandler(async (req, res) => {
  const operator = getOperator(req);
  const result = await supplementService.createSupplement(
    req.params.applicationId,
    req.body,
    operator
  );
  res.json(createResponse(true, result, '材料补正创建成功'));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const result = await supplementService.getSupplementById(req.params.id);
  res.json(createResponse(true, result, '查询成功'));
}));

router.post('/:id/submit', asyncHandler(async (req, res) => {
  const operator = getOperator(req);
  const result = await supplementService.submitSupplement(
    req.params.id,
    req.body,
    operator
  );
  res.json(createResponse(true, result, '补正材料提交成功'));
}));

router.post('/:id/overdue', asyncHandler(async (req, res) => {
  const operator = getOperator(req);
  const result = await supplementService.markSupplementOverdue(
    req.params.id,
    operator
  );
  res.json(createResponse(true, result, '已标记为逾期'));
}));

router.post('/:id/cancel', asyncHandler(async (req, res) => {
  const operator = getOperator(req);
  const result = await supplementService.cancelSupplement(
    req.params.id,
    req.body.reason,
    operator
  );
  res.json(createResponse(true, result, '材料补正已取消'));
}));

module.exports = router;
