const express = require('express');
const router = express.Router();
const deliveryService = require('../services/deliveryService');
const { buildSuccessResponse, buildErrorResponse } = require('../utils/common');

router.post('/loads', async (req, res) => {
  const { mealPlanId, routeId, loadedBy } = req.body;
  
  if (!mealPlanId || !routeId) {
    return res.status(400).json(buildErrorResponse('请提供配餐计划ID和线路ID', 400));
  }

  try {
    const result = await deliveryService.createRouteLoad(parseInt(mealPlanId), parseInt(routeId), loadedBy || 'system');
    res.json(buildSuccessResponse(result, result.success ? '线路装载创建成功' : result.message));
  } catch (err) {
    res.status(500).json(buildErrorResponse('创建装载失败', 500, err.message));
  }
});

router.post('/loads/:loadId/confirm', async (req, res) => {
  const { loadId } = req.params;
  const { confirmedBy } = req.body;
  
  try {
    const result = await deliveryService.confirmRouteLoad(parseInt(loadId), confirmedBy || 'system');
    res.json(buildSuccessResponse(result, '线路装载已确认'));
  } catch (err) {
    res.status(400).json(buildErrorResponse(err.message, 400));
  }
});

router.post('/receipts', async (req, res) => {
  const { loadId, schoolId, receivedBy, receivedCount, condition, signature } = req.body;
  
  if (!loadId || !schoolId || !receivedBy || receivedCount === undefined) {
    return res.status(400).json(buildErrorResponse('缺少必填参数', 400));
  }

  try {
    const result = await deliveryService.createDeliveryReceipt(
      parseInt(loadId),
      parseInt(schoolId),
      receivedBy,
      parseInt(receivedCount),
      condition || '正常',
      signature || ''
    );
    res.json(buildSuccessResponse(result, '签收回执已记录'));
  } catch (err) {
    res.status(500).json(buildErrorResponse('签收失败', 500, err.message));
  }
});

router.post('/exceptions', async (req, res) => {
  const { mealPlanId, stepName, exceptionType, description, relatedEntityType, relatedEntityId, reportedBy } = req.body;
  
  if (!mealPlanId || !stepName || !exceptionType || !description) {
    return res.status(400).json(buildErrorResponse('缺少必填参数', 400));
  }

  try {
    const result = await deliveryService.createExceptionReport(
      parseInt(mealPlanId),
      stepName,
      exceptionType,
      description,
      relatedEntityType || '',
      relatedEntityId ? parseInt(relatedEntityId) : null,
      reportedBy || 'system'
    );
    res.json(buildSuccessResponse(result, '异常报告已提交'));
  } catch (err) {
    res.status(500).json(buildErrorResponse('提交失败', 500, err.message));
  }
});

router.get('/exceptions/:mealPlanId', async (req, res) => {
  const { mealPlanId } = req.params;
  const { status } = req.query;
  
  try {
    const exceptions = await deliveryService.getExceptions(parseInt(mealPlanId), status);
    res.json(buildSuccessResponse(exceptions));
  } catch (err) {
    res.status(500).json(buildErrorResponse('查询失败', 500, err.message));
  }
});

router.post('/exceptions/:exceptionId/resolve', async (req, res) => {
  const { exceptionId } = req.params;
  const { resolution, resolvedBy } = req.body;
  
  if (!resolution) {
    return res.status(400).json(buildErrorResponse('请提供处理方案', 400));
  }

  try {
    const result = await deliveryService.resolveException(parseInt(exceptionId), resolution, resolvedBy || 'system');
    res.json(buildSuccessResponse(result, '异常已解决'));
  } catch (err) {
    res.status(500).json(buildErrorResponse('处理失败', 500, err.message));
  }
});

router.post('/:mealPlanId/complete', async (req, res) => {
  const { mealPlanId } = req.params;
  const { operator } = req.body;
  
  try {
    const result = await deliveryService.completeDelivery(parseInt(mealPlanId), operator || 'system');
    res.json(buildSuccessResponse(result, result.success ? '配餐完成' : result.message));
  } catch (err) {
    res.status(400).json(buildErrorResponse(err.message, 400));
  }
});

module.exports = router;
