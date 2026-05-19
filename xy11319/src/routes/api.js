const fs = require('fs');
const path = require('path');
const multer = require('multer');
const ImportService = require('../services/importService');
const ReconciliationService = require('../services/reconciliationService');
const ExportService = require('../services/exportService');
const { maskForResponse } = require('../utils/maskSensitive');

const importService = new ImportService();
const reconciliationService = new ReconciliationService();
const exportService = new ExportService();

const UPLOAD_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ storage });

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = (app) => {
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/stats', asyncHandler(async (req, res) => {
    const stats = await reconciliationService.getStatistics();
    res.json({ success: true, data: stats });
  }));

  app.post('/api/import/driver', upload.single('file'), asyncHandler(async (req, res) => {
    const result = await importService.importBaseData(req.file.path, 'driver', req.query.operator);
    res.json({ success: true, data: result });
  }));

  app.post('/api/import/bus', upload.single('file'), asyncHandler(async (req, res) => {
    const result = await importService.importBaseData(req.file.path, 'bus', req.query.operator);
    res.json({ success: true, data: result });
  }));

  app.post('/api/import/student', upload.single('file'), asyncHandler(async (req, res) => {
    const result = await importService.importBaseData(req.file.path, 'student', req.query.operator);
    res.json({ success: true, data: result });
  }));

  app.post('/api/import/checkin', upload.single('file'), asyncHandler(async (req, res) => {
    const result = await importService.importDriverCheckins(req.file.path, req.query.operator);
    res.json({ success: true, data: result });
  }));

  app.post('/api/import/gps', upload.single('file'), asyncHandler(async (req, res) => {
    const result = await importService.importGpsTracks(req.file.path, req.query.operator);
    res.json({ success: true, data: result });
  }));

  app.post('/api/import/complaint', upload.single('file'), asyncHandler(async (req, res) => {
    const result = await importService.importParentComplaints(req.file.path, req.query.operator);
    res.json({ success: true, data: result });
  }));

  app.post('/api/reconciliation/auto', asyncHandler(async (req, res) => {
    const result = await reconciliationService.autoReconcilePendingComplaints(req.query.operator);
    res.json({ success: true, data: result });
  }));

  app.get('/api/reconciliation', asyncHandler(async (req, res) => {
    const { status, startDate, endDate } = req.query;
    const records = await reconciliationService.getReconciliationList({ status, startDate, endDate });
    res.json({ success: true, data: records });
  }));

  app.get('/api/reconciliation/:id', asyncHandler(async (req, res) => {
    const record = await reconciliationService.getReconciliationDetail(req.params.id);
    res.json({ success: true, data: record });
  }));

  app.post('/api/reconciliation/:id/review', asyncHandler(async (req, res) => {
    const { status, result, responsibility, notes, reviewedBy } = req.body;
    const record = await reconciliationService.reviewReconciliation(
      req.params.id,
      status,
      result,
      responsibility,
      notes,
      reviewedBy || req.query.operator
    );
    res.json({ success: true, data: record });
  }));

  app.get('/api/complaint', asyncHandler(async (req, res) => {
    const { ParentComplaintDAO } = require('../dao/reconciliationDAO');
    const dao = new ParentComplaintDAO();
    const complaints = await dao.getAll();
    res.json({ success: true, data: maskForResponse(complaints) });
  }));

  app.get('/api/checkin', asyncHandler(async (req, res) => {
    const { DriverCheckinDAO } = require('../dao/reconciliationDAO');
    const dao = new DriverCheckinDAO();
    const checkins = await dao.getAll();
    res.json({ success: true, data: checkins });
  }));

  app.get('/api/gps', asyncHandler(async (req, res) => {
    const { GpsTrackDAO } = require('../dao/reconciliationDAO');
    const dao = new GpsTrackDAO();
    const tracks = await dao.getAll();
    res.json({ success: true, data: tracks });
  }));

  app.get('/api/export/reconciliation', asyncHandler(async (req, res) => {
    const { status, startDate, endDate, operator } = req.query;
    const result = await exportService.exportReconciliations({ status, startDate, endDate }, operator);
    res.json({ success: true, data: result });
  }));

  app.get('/api/export/complaint', asyncHandler(async (req, res) => {
    const { startDate, endDate, operator } = req.query;
    const result = await exportService.exportComplaints({ startDate, endDate }, operator);
    res.json({ success: true, data: result });
  }));

  app.get('/api/export/checkin', asyncHandler(async (req, res) => {
    const { startDate, endDate, operator } = req.query;
    const result = await exportService.exportDriverCheckins(startDate, endDate, operator);
    res.json({ success: true, data: result });
  }));

  app.get('/api/export/files', asyncHandler(async (req, res) => {
    const files = await exportService.getExportList();
    res.json({ success: true, data: files });
  }));

  app.get('/api/export/download/:filename', asyncHandler(async (req, res) => {
    const filePath = exportService.getFilePath(req.params.filename);
    if (!filePath) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
    res.download(filePath);
  }));

  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, error: err.message });
  });
};