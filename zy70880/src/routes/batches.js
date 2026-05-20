const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const batchService = require('../services/batchService');
const importService = require('../services/importService');
const queryService = require('../services/queryService');

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
    const result = await batchService.createBatch(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const result = await batchService.getBatches(req.query);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await batchService.getBatchById(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/import-meter', upload.single('file'), async (req, res) => {
  try {
    const result = await importService.importMeterCSV(req.file.path, req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/import-contracts', upload.single('file'), async (req, res) => {
  try {
    const result = await importService.importContractJSON(req.file.path);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/import-zones', async (req, res) => {
  try {
    const result = await importService.importTemperatureZones(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id/readings', async (req, res) => {
  try {
    const result = await queryService.getReadingsByBatch(req.params.id, req.query);
    res.json({ success: true, data: result, count: result.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/readings/:readingId/process', async (req, res) => {
  try {
    const { action, reason, processed_by, corrected_data } = req.body;
    
    let result;
    if (action === 'return') {
      result = await batchService.returnForRevision(req.params.readingId, reason, processed_by);
    } else if (action === 'approve') {
      result = await batchService.approveReading(req.params.readingId, reason, processed_by);
    } else if (action === 'manual_fix') {
      result = await batchService.manualFix(req.params.readingId, reason, processed_by, corrected_data);
    } else {
      result = await batchService.processReading(req.params.readingId, action, reason, processed_by);
    }
    
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/readings/:readingId/history', async (req, res) => {
  try {
    const result = await queryService.getReadingsWithHistory(req.params.readingId);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/zones/:zoneId/contracts', async (req, res) => {
  try {
    const result = await queryService.getContractsByZone(req.params.zoneId);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/meters/:meterId/multiplier', async (req, res) => {
  try {
    const result = await queryService.getMeterMultipliers(req.params.meterId);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id/export-readings', async (req, res) => {
  try {
    const result = await queryService.exportReadings(req.params.id, req.query);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="readings_${req.params.id}.csv"`);
    res.send(result.csv);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id/export-allocations', async (req, res) => {
  try {
    const result = await queryService.exportAllocations(req.params.id, req.query.tenant_id);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="allocations_${req.params.id}.csv"`);
    res.send(result.csv);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/calculate-allocations', async (req, res) => {
  try {
    const result = await queryService.calculateAllocations(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/allocations', async (req, res) => {
  try {
    const result = await queryService.getTenantAllocations(req.query.tenant_id, req.query.batch_id);
    res.json({ success: true, data: result, count: result.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
