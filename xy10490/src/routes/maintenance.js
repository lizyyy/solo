const express = require('express');
const router = express.Router();
const MaintenancePlanService = require('../services/MaintenancePlanService');
const { asyncHandler } = require('../middleware/error');
const { completeMaintenanceSchema, validate } = require('../middleware/validator');

router.get('/', asyncHandler(async (req, res) => {
  const plans = await MaintenancePlanService.getAllPlans(req.query);
  res.json({
    success: true,
    data: plans
  });
}));

router.get('/pending', asyncHandler(async (req, res) => {
  const plans = await MaintenancePlanService.getPendingPlans(req.query.equipmentId);
  res.json({
    success: true,
    data: plans
  });
}));

router.get('/:planId', asyncHandler(async (req, res) => {
  const plan = await MaintenancePlanService.getPlanById(req.params.planId);
  res.json({
    success: true,
    data: plan
  });
}));

router.post('/:planId/complete', validate(completeMaintenanceSchema), asyncHandler(async (req, res) => {
  const result = await MaintenancePlanService.completeMaintenance(req.params.planId, req.body);
  res.json({
    success: true,
    message: '保养完成',
    data: result
  });
}));

module.exports = router;
