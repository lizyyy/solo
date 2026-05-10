const express = require('express');
const router = express.Router();
const studentCountService = require('../services/studentCountService');
const { buildSuccessResponse, buildErrorResponse } = require('../utils/common');

router.post('/requests', async (req, res) => {
  const { classId, mealPlanId, changeType, newCount, reason, createdBy } = req.body;
  
  if (!classId || !mealPlanId || !changeType || newCount === undefined) {
    return res.status(400).json(buildErrorResponse('缺少必填参数', 400));
  }

  try {
    const result = await studentCountService.requestCountChange(
      parseInt(classId),
      parseInt(mealPlanId),
      changeType,
      parseInt(newCount),
      reason || '',
      createdBy || 'system'
    );
    res.json(buildSuccessResponse(result, '人数变更申请已提交'));
  } catch (err) {
    res.status(500).json(buildErrorResponse('提交失败', 500, err.message));
  }
});

router.get('/requests/:mealPlanId/pending', async (req, res) => {
  const { mealPlanId } = req.params;
  try {
    const changes = await studentCountService.getPendingChanges(parseInt(mealPlanId));
    res.json(buildSuccessResponse(changes));
  } catch (err) {
    res.status(500).json(buildErrorResponse('查询失败', 500, err.message));
  }
});

router.get('/requests/:mealPlanId', async (req, res) => {
  const { mealPlanId } = req.params;
  try {
    const changes = await studentCountService.getAllChanges(parseInt(mealPlanId));
    res.json(buildSuccessResponse(changes));
  } catch (err) => {
    res.status(500).json(buildErrorResponse('查询失败', 500, err.message));
  }
});

router.post('/requests/:changeId/review', async (req, res) => {
  const { changeId } = req.params;
  const { action, reviewedBy, reviewNote } = req.body;
  
  if (!action || (action !== 'approve' && action !== 'reject')) {
    return res.status(400).json(buildErrorResponse('请提供有效的审核操作(action: approve/reject)', 400));
  }

  try {
    const result = await studentCountService.reviewCountChange(
      parseInt(changeId),
      action,
      reviewedBy || 'system',
      reviewNote || ''
    );
    res.json(buildSuccessResponse(result, result.message));
  } catch (err) {
    res.status(400).json(buildErrorResponse(err.message, 400));
  }
});

module.exports = router;
