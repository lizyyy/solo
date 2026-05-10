const express = require('express');
const router = express.Router();
const processLogService = require('../services/processLogService');
const { buildSuccessResponse, buildErrorResponse } = require('../utils/common');

router.get('/:planId/status', async (req, res) => {
  const { planId } = req.params;
  try {
    const status = await processLogService.getProcessStatus(parseInt(planId));
    res.json(buildSuccessResponse(status));
  } catch (err) {
    res.status(500).json(buildErrorResponse('查询失败', 500, err.message));
  }
});

router.get('/:planId/previous/:stepName', async (req, res) => {
  const { planId, stepName } = req.params;
  try {
    const records = await processLogService.getPreviousProcessRecord(parseInt(planId), stepName);
    res.json(buildSuccessResponse(records || { message: '暂无该步骤的历史记录' }));
  } catch (err) {
    res.status(500).json(buildErrorResponse('查询失败', 500, err.message));
  }
});

router.get('/steps', (req, res) => {
  res.json(buildSuccessResponse({
    steps: processLogService.STEPS,
    description: '配餐流程共7个步骤，需按顺序执行，任何一步被拒绝都会导致流程卡阻'
  }));
});

module.exports = router;
