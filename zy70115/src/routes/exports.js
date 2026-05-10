const express = require('express');
const router = express.Router();
const exportService = require('../services/exportService');
const { buildSuccessResponse, buildErrorResponse } = require('../utils/common');

router.get('/mealPlan/:planId', async (req, res) => {
  const { planId } = req.params;
  try {
    const path = await exportService.exportMealPlanReview(parseInt(planId));
    res.json(buildSuccessResponse({ filePath: path, exportDir: exportService.exportsDir }, '配餐计划复核文件已生成'));
  } catch (err) {
    res.status(500).json(buildErrorResponse('导出失败', 500, err.message));
  }
});

router.get('/delivery/:planId', async (req, res) => {
  const { planId } = req.params;
  try {
    const path = await exportService.exportDeliveryReceipts(parseInt(planId));
    res.json(buildSuccessResponse({ filePath: path, exportDir: exportService.exportsDir }, '配送签收复核文件已生成'));
  } catch (err) {
    res.status(500).json(buildErrorResponse('导出失败', 500, err.message));
  }
});

router.get('/exception/:planId', async (req, res) => {
  const { planId } = req.params;
  try {
    const path = await exportService.exportExceptionReport(parseInt(planId));
    res.json(buildSuccessResponse({ filePath: path, exportDir: exportService.exportsDir }, '异常报告已生成'));
  } catch (err) {
    res.status(500).json(buildErrorResponse('导出失败', 500, err.message));
  }
});

router.get('/process/:planId', async (req, res) => {
  const { planId } = req.params;
  try {
    const path = await exportService.exportProcessFlow(parseInt(planId));
    res.json(buildSuccessResponse({ filePath: path, exportDir: exportService.exportsDir }, '流程追溯文件已生成'));
  } catch (err) {
    res.status(500).json(buildErrorResponse('导出失败', 500, err.message));
  }
});

router.get('/full/:planId', async (req, res) => {
  const { planId } = req.params;
  try {
    const result = await exportService.exportFullReview(parseInt(planId));
    res.json(buildSuccessResponse(result, '全部复核文件已生成'));
  } catch (err) {
    res.status(500).json(buildErrorResponse('导出失败', 500, err.message));
  }
});

module.exports = router;
