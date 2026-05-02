const express = require('express');
const router = express.Router();
const storage = require('../storage');
const stateMachine = require('../stateMachine');
const importExport = require('../importExport');

router.get('/', (req, res) => {
  try {
    const { userId, action, startDate, endDate } = req.query;
    
    const filters = {};
    if (userId) filters.userId = userId;
    if (action) filters.action = action;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    const logs = stateMachine.getAuditLogs(filters);

    res.json({
      success: true,
      total: logs.length,
      logs
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/stats', (req, res) => {
  try {
    const stats = stateMachine.getStatistics();
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/import/users', async (req, res) => {
  try {
    const { csvContent } = req.body;
    
    if (!csvContent) {
      return res.status(400).json({ success: false, error: 'CSV内容不能为空' });
    }

    const result = await importExport.importUsersFromCSV(csvContent);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/export/users', (req, res) => {
  try {
    const csvContent = importExport.exportUsersToCSV();
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=users.csv');
    res.send(csvContent);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/export/report', (req, res) => {
  try {
    const { userId, startDate, endDate } = req.query;
    
    const options = {};
    if (userId) options.userId = userId;
    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;

    const report = importExport.exportMarkdownReport(options);
    
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', 'attachment; filename=security-report.md');
    res.send(report);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/export/audit', (req, res) => {
  try {
    const { userId, action, startDate, endDate } = req.query;
    
    const options = {};
    if (userId) options.userId = userId;
    if (action) options.action = action;
    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;

    const auditPackage = importExport.exportAuditPackage(options);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=audit-package.json');
    res.send(auditPackage);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/sample/csv', (req, res) => {
  try {
    const sampleCsv = importExport.generateSampleCSV();
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=sample-users.csv');
    res.send(sampleCsv);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/reset', (req, res) => {
  try {
    storage.resetAll();
    
    storage.createAuditLog({
      action: 'DATA_RESET',
      details: { source: 'API_RESET' }
    });

    res.json({ success: true, message: '所有数据已重置' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
