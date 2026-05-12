const express = require('express');
const router = express.Router();
const studentStopService = require('../services/studentStopService');

router.get('/', (req, res) => {
  const filters = { ...req.query };
  if (filters.isTemporary !== undefined) {
    filters.isTemporary = filters.isTemporary === 'true';
  }
  const result = studentStopService.getStudentStops(filters);
  res.json(result);
});

router.get('/:id', (req, res) => {
  const result = studentStopService.getStudentStopById(req.params.id);
  if (result.success) {
    res.json(result);
  } else {
    res.status(404).json(result);
  }
});

router.post('/:id/confirm', (req, res) => {
  const result = studentStopService.confirmStudentStop(req.params.id, req.body);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

module.exports = router;