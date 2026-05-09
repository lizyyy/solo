const express = require('express');
const router = express.Router();
const surveyService = require('../services/surveyService');
const { createResponse, asyncHandler } = require('../utils/helpers');

const getOperator = (req) => req.headers['x-operator'] || 'system';

router.post('/application/:applicationId', asyncHandler(async (req, res) => {
  const operator = getOperator(req);
  const result = await surveyService.createSurvey(
    req.params.applicationId,
    req.body,
    operator
  );
  res.json(createResponse(true, result, '勘察预约创建成功'));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const result = await surveyService.getSurveyById(req.params.id);
  res.json(createResponse(true, result, '查询成功'));
}));

router.post('/:id/schedule', asyncHandler(async (req, res) => {
  const operator = getOperator(req);
  const { scheduled_time, surveyor } = req.body;
  const result = await surveyService.scheduleSurvey(
    req.params.id,
    scheduled_time,
    surveyor,
    operator
  );
  res.json(createResponse(true, result, '勘察预约成功'));
}));

router.post('/:id/complete', asyncHandler(async (req, res) => {
  const operator = getOperator(req);
  const result = await surveyService.completeSurvey(
    req.params.id,
    req.body,
    operator
  );
  res.json(createResponse(true, result, '勘察完成'));
}));

router.post('/:id/cancel', asyncHandler(async (req, res) => {
  const operator = getOperator(req);
  const result = await surveyService.cancelSurvey(
    req.params.id,
    req.body.reason,
    operator
  );
  res.json(createResponse(true, result, '勘察已取消'));
}));

router.post('/:id/fail', asyncHandler(async (req, res) => {
  const operator = getOperator(req);
  const result = await surveyService.failSurvey(
    req.params.id,
    req.body.reason,
    operator
  );
  res.json(createResponse(true, result, '勘察已标记为失败'));
}));

module.exports = router;
