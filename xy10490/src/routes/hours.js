const express = require('express');
const router = express.Router();
const HourReportService = require('../services/HourReportService');
const { asyncHandler } = require('../middleware/error');
const { hourReportSchema, validate } = require('../middleware/validator');

router.post('/:equipmentId/report', validate(hourReportSchema), asyncHandler(async (req, res) => {
  const result = await HourReportService.reportHours(req.params.equipmentId, req.body);
  
  if (result.isDuplicate) {
    res.status(200).json({
      success: true,
      message: '重复上报，返回已有记录',
      isDuplicate: true,
      data: result
    });
  } else {
    res.status(201).json({
      success: true,
      isDuplicate: false,
      data: result
    });
  }
}));

router.get('/:equipmentId', asyncHandler(async (req, res) => {
  const reports = await HourReportService.getHourReports(req.params.equipmentId, req.query);
  res.json({
    success: true,
    data: reports
  });
}));

module.exports = router;
