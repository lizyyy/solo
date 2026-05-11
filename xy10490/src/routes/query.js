const express = require('express');
const router = express.Router();
const QueryService = require('../services/QueryService');
const { asyncHandler } = require('../middleware/error');

router.get('/equipment/:equipmentId/status', asyncHandler(async (req, res) => {
  const status = await QueryService.getEquipmentMaintenanceStatus(req.params.equipmentId);
  res.json({
    success: true,
    data: status
  });
}));

router.get('/equipment/:equipmentId/history', asyncHandler(async (req, res) => {
  const history = await QueryService.getMaintenanceHistory(
    req.params.equipmentId,
    parseInt(req.query.limit) || 50
  );
  res.json({
    success: true,
    data: history
  });
}));

router.get('/overdue', asyncHandler(async (req, res) => {
  const equipment = await QueryService.getOverdueEquipment(req.query);
  res.json({
    success: true,
    data: equipment
  });
}));

router.get('/summary', asyncHandler(async (req, res) => {
  const summary = await QueryService.getEquipmentStatusSummary();
  res.json({
    success: true,
    data: summary
  });
}));

router.get('/production-line/:lineName', asyncHandler(async (req, res) => {
  const status = await QueryService.getProductionLineStatus(req.params.lineName);
  res.json({
    success: true,
    data: status
  });
}));

router.get('/affected-lines', asyncHandler(async (req, res) => {
  const lines = await QueryService.getAffectedProductionLines();
  res.json({
    success: true,
    data: lines
  });
}));

module.exports = router;
