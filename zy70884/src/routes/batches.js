const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const batchService = require('../services/batchService');
const contractService = require('../services/contractService');
const importService = require('../services/importService');
const exportService = require('../services/exportService');
const { getLogsByBatchId } = require('../services/auditService');

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

router.post('/', async (req, res) => {
  try {
    const handler = req.headers['x-handler'] || 'system';
    const result = await batchService.createBatch(req.body, handler);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/import-csv', upload.single('csv'), async (req, res) => {
  try {
    const batchId = req.params.id;
    const result = await importService.importContractsFromCSV(req.file.path, batchId);
    fs.unlinkSync(req.file.path);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const batches = await batchService.getAllBatches();
    res.json({ success: true, data: batches });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const batch = await batchService.getBatchById(req.params.id);
    if (!batch) {
      return res.status(404).json({ success: false, error: '批次不存在' });
    }
    const contracts = await contractService.getContractsByBatchId(req.params.id);
    const logs = await getLogsByBatchId(req.params.id);
    res.json({ success: true, data: { batch, contracts, auditLogs: logs } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const handler = req.headers['x-handler'] || 'system';
    const { status, reason } = req.body;
    const result = await batchService.updateBatchStatus(req.params.id, status, handler, reason);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/return', async (req, res) => {
  try {
    const handler = req.headers['x-handler'] || 'system';
    const { reason } = req.body;
    const result = await batchService.returnBatchForModification(req.params.id, handler, reason);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/export', async (req, res) => {
  try {
    const handler = req.headers['x-handler'] || 'system';
    const result = await exportService.exportBatchToCSV(req.params.id, handler);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.csv);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
