const express = require('express');
const router = express.Router();
const ExportService = require('../services/ExportService');

router.get('/histories', (req, res) => {
  const { operator, startTime, endTime } = req.query;
  const buffer = ExportService.exportHistories({ operator, startTime, endTime });
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=histories_${Date.now()}.xlsx`);
  res.send(buffer);
});

router.get('/cylinders', (req, res) => {
  const { status } = req.query;
  const buffer = ExportService.exportCylinders(status);
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=cylinders_${Date.now()}.xlsx`);
  res.send(buffer);
});

router.get('/operators', (req, res) => {
  const operators = ExportService.getAllOperators();
  res.json({ success: true, data: operators });
});

module.exports = router;
