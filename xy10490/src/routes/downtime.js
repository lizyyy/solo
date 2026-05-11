const express = require('express');
const router = express.Router();
const DowntimeImpactService = require('../services/DowntimeImpactService');
const { asyncHandler } = require('../middleware/error');
const { downtimeImpactSchema, validate } = require('../middleware/validator');

router.post('/:equipmentId', validate(downtimeImpactSchema), asyncHandler(async (req, res) => {
  const impact = await DowntimeImpactService.recordImpact(req.params.equipmentId, req.body);
  res.status(201).json({
    success: true,
    data: impact
  });
}));

router.get('/:equipmentId', asyncHandler(async (req, res) => {
  const impacts = await DowntimeImpactService.getImpactsByEquipment(req.params.equipmentId, req.query);
  res.json({
    success: true,
    data: impacts
  });
}));

router.put('/:impactId/end', asyncHandler(async (req, res) => {
  const impact = await DowntimeImpactService.updateImpactEndTime(
    req.params.impactId,
    req.body.endTime
  );
  res.json({
    success: true,
    data: impact
  });
}));

module.exports = router;
