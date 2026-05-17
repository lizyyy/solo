const express = require('express');
const router = express.Router();
const LockService = require('../services/lockService');
const ImportService = require('../services/importService');
const ExportService = require('../services/exportService');
const fs = require('fs');

router.post('/', async (req, res) => {
  try {
    const result = await LockService.createLock(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const result = await LockService.getLockList(req.query);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await LockService.getLockDetail(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id/history', async (req, res) => {
  try {
    const result = await LockService.getLockHistory(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/status', async (req, res) => {
  try {
    const { action, operator, remark } = req.body;
    const result = await LockService.updateStatus(req.params.id, action, operator, remark);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/import', async (req, res) => {
  try {
    const { records, operator } = req.body;
    const result = await ImportService.batchImport(records, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/import/:batchId', async (req, res) => {
  try {
    const result = await ImportService.getBatchDetail(req.params.batchId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/export', async (req, res) => {
  try {
    const result = await ExportService.exportLocks(req.body);
    res.json({ 
      success: true, 
      data: {
        filename: result.filename,
        count: result.count,
        download_url: `/api/locks/export/download/${result.filename}`
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/export/download/:filename', (req, res) => {
  const filepath = require('path').join(__dirname, '../../exports', req.params.filename);
  if (fs.existsSync(filepath)) {
    res.download(filepath);
  } else {
    res.status(404).json({ success: false, error: '文件不存在' });
  }
});

router.post('/:id/export-history', async (req, res) => {
  try {
    const result = await ExportService.exportHistory(req.params.id);
    res.json({ 
      success: true, 
      data: {
        filename: result.filename,
        count: result.count,
        download_url: `/api/locks/export/download/${result.filename}`
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
