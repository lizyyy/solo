const express = require('express');
const router = express.Router();
const ticketService = require('../services/ticketService');
const importExportService = require('../services/importExportService');
const path = require('path');

router.post('/', async (req, res) => {
  try {
    const result = await ticketService.createTicket(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const result = await ticketService.listTickets(req.query);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await ticketService.getTicket(req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, error: '工单不存在' });
    }
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const result = await ticketService.updateStatus(req.params.id, req.body);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/:id/history', async (req, res) => {
  try {
    const result = await ticketService.getHistory(req.params.id);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/import', async (req, res) => {
  try {
    const { filePath } = req.body;
    if (!filePath) {
      return res.status(400).json({ success: false, error: '请提供文件路径' });
    }
    const result = await importExportService.importFromCsv(filePath);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/:batchId/validation', async (req, res) => {
  try {
    const result = await ticketService.getValidationResults(req.params.batchId);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/export/download', async (req, res) => {
  try {
    const exportPath = path.join(__dirname, '../../data/export.csv');
    const result = await importExportService.exportToCsv(exportPath);
    res.download(result.filePath, 'tickets_export.csv');
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

module.exports = router;
