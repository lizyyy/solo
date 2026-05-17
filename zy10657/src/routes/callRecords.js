const express = require('express');
const router = express.Router();
const callRecordService = require('../services/CallRecordService');
const exportService = require('../services/ExportService');

router.post('/', async (req, res) => {
  try {
    const { taskBatchId, phoneNumber, customerName } = req.body;
    const record = callRecordService.createCallRecord(taskBatchId, phoneNumber, customerName);
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const record = callRecordService.updateCallRecord(id, req.body);
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/review', async (req, res) => {
  try {
    const { id } = req.params;
    const { operator, approved, comment } = req.body;
    const record = callRecordService.reviewCallRecord(id, operator, approved, comment);
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/withdraw', async (req, res) => {
  try {
    const { id } = req.params;
    const { operator, reason } = req.body;
    const record = callRecordService.withdrawCallRecord(id, operator, reason);
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/mark-called', async (req, res) => {
  try {
    const { id } = req.params;
    const { callResult } = req.body;
    const record = callRecordService.markAsCalled(id, callResult);
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const records = callRecordService.getCallRecords(req.query);
    res.json({ success: true, data: records, total: records.length });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const record = callRecordService.getCallRecordById(id);
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/bulk-import', async (req, res) => {
  try {
    const { taskBatchId, records, operator } = req.body;
    const result = callRecordService.bulkImport(taskBatchId, records, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/export', async (req, res) => {
  try {
    const { filters, filename } = req.body;
    const records = callRecordService.getCallRecords(filters || {});
    const result = await exportService.exportCallRecordsToCSV(records, filename);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id/export-history', async (req, res) => {
  try {
    const { id } = req.params;
    const record = callRecordService.getCallRecordById(id);
    const result = await exportService.exportHistoryToCSV(id, record.history);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/export/files', async (req, res) => {
  try {
    const files = exportService.getExportFiles();
    res.json({ success: true, data: files });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
