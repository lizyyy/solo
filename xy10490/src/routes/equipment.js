const express = require('express');
const router = express.Router();
const EquipmentService = require('../services/EquipmentService');
const { asyncHandler } = require('../middleware/error');
const { equipmentCreateSchema, validate } = require('../middleware/validator');

router.post('/', validate(equipmentCreateSchema), asyncHandler(async (req, res) => {
  const result = await EquipmentService.createEquipment(req.body);
  res.status(201).json({
    success: true,
    data: result
  });
}));

router.get('/', asyncHandler(async (req, res) => {
  const equipment = await EquipmentService.getAllEquipment(req.query);
  res.json({
    success: true,
    data: equipment
  });
}));

router.get('/:equipmentId', asyncHandler(async (req, res) => {
  const equipment = await EquipmentService.getEquipmentById(req.params.equipmentId);
  res.json({
    success: true,
    data: equipment
  });
}));

router.get('/:equipmentId/status', asyncHandler(async (req, res) => {
  const status = await EquipmentService.getEquipmentWithStatus(req.params.equipmentId);
  res.json({
    success: true,
    data: status
  });
}));

router.put('/:equipmentId', asyncHandler(async (req, res) => {
  const equipment = await EquipmentService.updateEquipment(req.params.equipmentId, req.body);
  res.json({
    success: true,
    data: equipment
  });
}));

module.exports = router;
