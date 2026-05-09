const express = require('express');
const router = express.Router();
const meterService = require('../services/meterService');
const { createResponse, asyncHandler } = require('../utils/helpers');

const getOperator = (req) => req.headers['x-operator'] || 'system';

router.post('/application/:applicationId', asyncHandler(async (req, res) => {
  const operator = getOperator(req);
  const result = await meterService.createMeterTask(
    req.params.applicationId,
    req.body,
    operator
  );
  res.json(createResponse(true, result, '电表任务创建成功'));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const result = await meterService.getMeterTaskById(req.params.id);
  res.json(createResponse(true, result, '查询成功'));
}));

router.post('/:id/schedule', asyncHandler(async (req, res) => {
  const operator = getOperator(req);
  const result = await meterService.scheduleMeterTask(
    req.params.id,
    req.body.installer,
    operator
  );
  res.json(createResponse(true, result, '电表任务已安排'));
}));

router.post('/:id/complete', asyncHandler(async (req, res) => {
  const operator = getOperator(req);
  const result = await meterService.completeMeterTask(
    req.params.id,
    req.body.meter_type,
    operator
  );
  res.json(createResponse(true, result, '电表安装完成'));
}));

router.post('/:id/cancel', asyncHandler(async (req, res) => {
  const operator = getOperator(req);
  const result = await meterService.cancelMeterTask(
    req.params.id,
    req.body.reason,
    operator
  );
  res.json(createResponse(true, result, '电表任务已取消'));
}));

router.post('/:id/fail', asyncHandler(async (req, res) => {
  const operator = getOperator(req);
  const result = await meterService.failMeterTask(
    req.params.id,
    req.body.reason,
    operator
  );
  res.json(createResponse(true, result, '电表任务已标记为失败'));
}));

module.exports = router;
