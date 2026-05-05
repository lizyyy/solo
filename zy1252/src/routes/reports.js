const express = require('express');
const { ReportGenerator } = require('../utils/reportGenerator');

const router = express.Router();

router.get('/json', async (req, res) => {
  const report = await ReportGenerator.generateJSONReport();
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="idempotency-report.json"');
  
  res.json(report);
});

router.get('/markdown', async (req, res) => {
  const report = await ReportGenerator.generateJSONReport();
  const markdown = ReportGenerator.generateMarkdownReport(report);
  
  res.setHeader('Content-Type', 'text/markdown');
  res.setHeader('Content-Disposition', 'attachment; filename="idempotency-report.md"');
  
  res.send(markdown);
});

router.get('/stats', async (req, res) => {
  const report = await ReportGenerator.generateJSONReport();
  
  res.json({
    success: true,
    data: report
  });
});

module.exports = router;
