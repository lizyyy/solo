const express = require('express');
const router = express.Router();
const {
  generateJSONReport,
  generateCSVReport,
  generateMarkdownReport,
} = require('../services/exportService');

router.get('/', async (req, res) => {
  try {
    const since = req.query.since ? parseInt(req.query.since) : null;
    const until = req.query.until ? parseInt(req.query.until) : null;
    const providerName = req.query.provider || null;
    const format = req.query.format || 'json';
    
    switch (format.toLowerCase()) {
      case 'json':
        const jsonReport = await generateJSONReport(since, until, providerName);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="webhook-report.json"');
        res.json(jsonReport);
        break;
        
      case 'csv':
        const csvReport = await generateCSVReport(since, until, providerName);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="webhook-report.csv"');
        res.send('\uFEFF' + csvReport);
        break;
        
      case 'md':
      case 'markdown':
        const mdReport = await generateMarkdownReport(since, until, providerName);
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="webhook-report.md"');
        res.send(mdReport);
        break;
        
      default:
        res.status(400).json({
          success: false,
          error: 'Invalid format. Supported formats: json, csv, md/markdown',
        });
    }
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

module.exports = router;
