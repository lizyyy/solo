const express = require('express');
const router = express.Router();

const CleaningController = require('../controllers/CleaningController');
const ComplaintController = require('../controllers/ComplaintController');
const ReworkController = require('../controllers/ReworkController');
const SettlementController = require('../controllers/SettlementController');
const ImportController = require('../controllers/ImportController');
const ExportController = require('../controllers/ExportController');
const OperationLog = require('../models/OperationLog');

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: '民宿运营后端系统 API',
    version: '1.0.0',
    endpoints: {
      cleaning: '/api/cleaning',
      complaints: '/api/complaints',
      reworks: '/api/reworks',
      settlements: '/api/settlements',
      import: '/api/import',
      export: '/api/export',
      logs: '/api/logs'
    }
  });
});

router.get('/api/cleaning', CleaningController.getAll);
router.post('/api/cleaning', CleaningController.create);
router.get('/api/cleaning/stats', CleaningController.getStats);
router.get('/api/cleaning/:id', CleaningController.getById);
router.put('/api/cleaning/:id', CleaningController.update);
router.post('/api/cleaning/:id/review', CleaningController.review);

router.get('/api/complaints', ComplaintController.getAll);
router.post('/api/complaints', ComplaintController.create);
router.get('/api/complaints/stats', ComplaintController.getStats);
router.get('/api/complaints/:id', ComplaintController.getById);
router.put('/api/complaints/:id', ComplaintController.update);
router.post('/api/complaints/:id/handle', ComplaintController.handle);

router.get('/api/reworks', ReworkController.getAll);
router.post('/api/reworks', ReworkController.create);
router.get('/api/reworks/stats', ReworkController.getStats);
router.get('/api/reworks/:id', ReworkController.getById);
router.put('/api/reworks/:id', ReworkController.update);
router.post('/api/reworks/:id/review', ReworkController.review);

router.get('/api/settlements', SettlementController.getAll);
router.post('/api/settlements', SettlementController.create);
router.post('/api/settlements/generate', SettlementController.generate);
router.get('/api/settlements/:id', SettlementController.getById);
router.put('/api/settlements/:id', SettlementController.update);
router.post('/api/settlements/:id/approve', SettlementController.approve);

const uploadMiddleware = ImportController.getUploadMiddleware();
router.get('/api/import/batches', ImportController.getBatches);
router.get('/api/import/batches/:id', ImportController.getBatchById);
router.get('/api/import/abnormal/:batchNumber', ImportController.getAbnormalRecords);
router.post('/api/import/cleaning', uploadMiddleware, ImportController.importCleaning);

router.get('/api/export/cleaning', ExportController.exportCleaning);
router.get('/api/export/complaints', ExportController.exportComplaints);
router.get('/api/export/reworks', ExportController.exportReworks);
router.get('/api/export/settlements', ExportController.exportSettlements);
router.get('/api/export/monthly-report', ExportController.exportMonthlyReport);
router.get('/api/export/download/:filename', ExportController.downloadFile);

router.get('/api/logs', async (req, res) => {
  try {
    const filters = {
      module: req.query.module,
      operation_type: req.query.operation_type,
      operator_name: req.query.operator_name,
      start_date: req.query.start_date,
      end_date: req.query.end_date
    };

    const logs = await OperationLog.findAll(filters);

    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;