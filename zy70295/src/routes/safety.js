const express = require('express');
const router = express.Router();
const safetyService = require('../services/safetyService');

router.post('/', (req, res) => {
  const result = safetyService.createSafetyRecord(req.body);
  if (result.success) {
    res.status(201).json(result);
  } else {
    res.status(400).json(result);
  }
});

router.get('/', (req, res) => {
  const filters = { ...req.query };
  if (filters.isTemporary !== undefined) {
    filters.isTemporary = filters.isTemporary === 'true';
  }
  const result = safetyService.getSafetyRecords(filters);
  res.json(result);
});

router.get('/:id', (req, res) => {
  const result = safetyService.getSafetyRecordById(req.params.id);
  if (result.success) {
    res.json(result);
  } else {
    res.status(404).json(result);
  }
});

module.exports = router;