const express = require('express');
const ExportService = require('../models/ExportService');
const fs = require('fs');
const path = require('path');

const router = express.Router();

router.post('/reports/:reportId', async (req, res) => {
  try {
    const result = await ExportService.exportReportToCSV(parseInt(req.params.reportId));
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/reports/:reportId/download', (req, res) => {
  try {
    const filePath = ExportService.getReportFile(parseInt(req.params.reportId));
    const fileName = path.basename(filePath);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Length', fs.statSync(filePath).size);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/complaints', async (req, res) => {
  try {
    const filters = {
      propertyId: req.body.propertyId,
      status: req.body.status,
      startDate: req.body.startDate,
      endDate: req.body.endDate
    };
    
    const result = await ExportService.exportComplaintsToCSV(filters);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/list', (req, res) => {
  const exportsDir = path.join(__dirname, '../../exports');
  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
  }
  const files = fs.readdirSync(exportsDir)
    .filter(file => file.endsWith('.csv'))
    .map(file => {
      const filePath = path.join(exportsDir, file);
      const stats = fs.statSync(filePath);
      return {
        fileName: file,
        filePath: filePath,
        size: stats.size,
        created: stats.birthtime
      };
    })
    .sort((a, b) => b.created - a.created);
  
  res.json({ success: true, data: files });
});

module.exports = router;
