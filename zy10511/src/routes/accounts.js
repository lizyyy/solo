const express = require('express');
const router = express.Router();
const accountService = require('../services/AccountService');
const exportService = require('../services/ExportService');

router.post('/', (req, res) => {
  try {
    const account = accountService.createAccount(req.body);
    res.json({ success: true, data: account });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/', (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      borrower: req.query.borrower,
      device: req.query.device
    };
    const accounts = accountService.getAllAccounts(filters);
    res.json({ success: true, data: accounts });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:accountNumber', (req, res) => {
  try {
    const account = accountService.getAccount(req.params.accountNumber);
    if (!account) {
      return res.status(404).json({ success: false, error: '账号不存在' });
    }
    res.json({ success: true, data: account });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:accountNumber/borrow', (req, res) => {
  try {
    const result = accountService.borrowAccount(req.params.accountNumber, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:accountNumber/return', (req, res) => {
  try {
    const result = accountService.returnAccount(req.params.accountNumber, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:accountNumber/manual-correct', (req, res) => {
  try {
    const result = accountService.manualCorrect(req.params.accountNumber, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:accountNumber/force-recover', (req, res) => {
  try {
    const { operator, reason } = req.body;
    const result = accountService.forceRecoverAccount(req.params.accountNumber, operator, reason);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:accountNumber/history', (req, res) => {
  try {
    const history = accountService.getBorrowHistory(req.params.accountNumber);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:accountNumber/logs', (req, res) => {
  try {
    const logs = accountService.getOperationLogs(req.params.accountNumber);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/check-overdue', (req, res) => {
  try {
    const recovered = accountService.checkAndRecoverOverdue();
    res.json({ success: true, data: { recoveredCount: recovered.length, recovered } });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/conflict/:device', (req, res) => {
  try {
    const conflicts = accountService.checkConflict(req.params.device);
    res.json({ success: true, data: { conflictCount: conflicts.length, conflicts } });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/abnormal/records', (req, res) => {
  try {
    const records = accountService.getAllAbnormalRecords();
    res.json({ success: true, data: records });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/export/accounts', async (req, res) => {
  try {
    const result = await exportService.exportAccountsToCSV(req.body.filters);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/export/borrow-history', async (req, res) => {
  try {
    const result = await exportService.exportBorrowHistoryToCSV(req.body.accountNumber);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/export/operation-logs', async (req, res) => {
  try {
    const result = await exportService.exportOperationLogsToCSV(req.body.accountNumber);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/export/abnormal-records', async (req, res) => {
  try {
    const result = await exportService.exportAbnormalRecordsToCSV();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/export/full-report', async (req, res) => {
  try {
    const result = await exportService.exportFullReport();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/export/files', (req, res) => {
  try {
    const files = exportService.getExportedFiles();
    res.json({ success: true, data: files });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
