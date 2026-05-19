const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const ImportService = require('../services/importService');
const AnomalyService = require('../services/anomalyService');
const ExportService = require('../services/exportService');
const ErrorHandler = require('../utils/errorHandler');

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'school-bus-schedule-service'
  });
});

router.get('/dashboard/summary', async (req, res) => {
  try {
    const summary = await AnomalyService.getDashboardSummary();
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/import/stops', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未上传文件' });
    }
    const result = await ImportService.importStopsFromCSV(req.file.path);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/import/gps', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未上传文件' });
    }
    const result = await ImportService.importGPSFromJSON(req.file.path);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/import/complaints', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未上传文件' });
    }
    const result = await ImportService.importComplaintsFromJSON(req.file.path);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/anomalies/analyze', async (req, res) => {
  try {
    const { route_id, date } = req.body;
    if (!route_id || !date) {
      return res.status(400).json({ error: 'route_id 和 date 为必填' });
    }
    const anomalies = await AnomalyService.analyzeRouteAnomalies(route_id, date);
    res.json({
      success: true,
      count: anomalies.length,
      anomalies
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/anomalies', async (req, res) => {
  try {
    const anomalies = await AnomalyService.getAnomalies(req.query);
    res.json({
      success: true,
      count: anomalies.length,
      data: anomalies
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/anomalies/:id/handle', async (req, res) => {
  try {
    const { id } = req.params;
    const { handler, status, responsibility, notes } = req.body;
    
    if (!handler || !status) {
      return res.status(400).json({ error: 'handler 和 status 为必填' });
    }
    
    const result = await AnomalyService.handleAnomaly(id, handler, status, responsibility, notes);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/export/anomalies', async (req, res) => {
  try {
    const result = await ExportService.exportAnomaliesToCSV(req.query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/export/complaints', async (req, res) => {
  try {
    const result = await ExportService.exportComplaintsToCSV(req.query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/import-errors', async (req, res) => {
  try {
    const errors = await ExportService.getImportErrors(req.query);
    res.json({
      success: true,
      count: errors.length,
      data: errors
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/import-errors/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const { resolved_by } = req.body;
    
    if (!resolved_by) {
      return res.status(400).json({ error: 'resolved_by 为必填' });
    }
    
    const result = await ErrorHandler.resolveError(id, resolved_by);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/processing-history', async (req, res) => {
  try {
    const history = await ExportService.getProcessingHistory(req.query);
    res.json({
      success: true,
      count: history.length,
      data: history
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
