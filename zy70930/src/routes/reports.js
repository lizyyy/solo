const express = require('express');
const router = express.Router();
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');
const reportService = require('../services/reportService');

router.get('/:id/excel', authenticateToken, async (req, res) => {
  try {
    const { filePath, fileName } = await reportService.generateExcelReport(
      req.params.id, req.user.id, req.user.realName
    );
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id/pdf', authenticateToken, async (req, res) => {
  try {
    const { filePath, fileName } = await reportService.generatePdfReport(
      req.params.id, req.user.id, req.user.realName
    );
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id/json', authenticateToken, async (req, res) => {
  try {
    const data = await reportService.getReportData(req.params.id);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
