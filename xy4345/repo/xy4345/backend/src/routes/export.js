const express = require('express');
const router = express.Router();
const exporter = require('../services/exporter');

router.get('/authorization-list', (req, res) => {
  try {
    const { program_id } = req.query;
    const markdown = exporter.exportAuthorizationList(program_id);
    
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=authorization-list.md');
    res.send(markdown);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/risk-table', (req, res) => {
  try {
    const csv = exporter.exportRiskTable();
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=risk-table.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/audit-package', (req, res) => {
  try {
    const json = exporter.exportAuditPackage();
    
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=audit-package.json');
    res.send(json);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
