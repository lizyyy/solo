const express = require('express');
const router = express.Router();
const CylinderService = require('../services/CylinderService');
const storage = require('../storage/memoryStorage');

router.post('/', (req, res) => {
  const result = CylinderService.createCylinder(req.body, req.body.operator);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

router.get('/', (req, res) => {
  const cylinders = storage.getAllCylinders();
  res.json({ success: true, data: cylinders });
});

router.get('/:id', (req, res) => {
  const result = CylinderService.getCylinderDetail(req.params.id);
  if (result.success) {
    res.json(result);
  } else {
    res.status(404).json(result);
  }
});

router.put('/:id', (req, res) => {
  const result = CylinderService.updateCylinderInfo(req.params.id, req.body, req.body.operator);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

router.post('/:id/transition', (req, res) => {
  const { toStatus, operator, reason, batchNo, customer, remark, requestId } = req.body;
  const result = CylinderService.transitionStatus(req.params.id, toStatus, {
    operator, reason, batchNo, customer, remark, requestId
  });
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

router.post('/:id/correct', (req, res) => {
  const { newStatus, operator, reason, remark, requestId } = req.body;
  const result = CylinderService.correctStatus(req.params.id, newStatus, {
    operator, reason, remark, requestId
  });
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

router.post('/batch-import', (req, res) => {
  const { cylinders, operator } = req.body;
  const result = CylinderService.batchImport(cylinders, operator);
  res.json({ success: true, data: result });
});

router.get('/:id/history', (req, res) => {
  const histories = storage.getHistoriesByCylinder(req.params.id);
  res.json({ success: true, data: histories });
});

module.exports = router;
