const express = require('express');
const XLSX = require('xlsx');
const ExportModel = require('../models/Export');
const router = express.Router();

router.get('/insights/:id', async (req, res) => {
  try {
    const data = await ExportModel.generateInsightExport(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/excel/:id', async (req, res) => {
  try {
    const wb = await ExportModel.exportToExcel(req.params.id);
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="annotation-insights-${req.params.id}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
