const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');

const BatchController = require('../controllers/batchController');
const WorkOrderController = require('../controllers/workOrderController');
const RepairController = require('../controllers/repairController');
const DefectController = require('../controllers/defectController');
const HistoryController = require('../controllers/historyController');
const FileUploadController = require('../controllers/fileUploadController');

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: '工厂质量追溯系统 API',
    version: '1.0.0',
    endpoints: {
      batches: '/api/batches',
      workOrders: '/api/work-orders',
      repairs: '/api/repairs',
      defects: '/api/defects',
      histories: '/api/histories',
      upload: '/api/upload'
    }
  });
});

router.post('/batches', BatchController.createBatch);
router.get('/batches', BatchController.getBatches);
router.get('/batches/:id', BatchController.getBatchById);
router.put('/batches/:id/status', BatchController.updateBatchStatus);
router.delete('/batches/:id', BatchController.deleteBatch);

router.post('/work-orders', WorkOrderController.createWorkOrder);
router.get('/work-orders', WorkOrderController.getWorkOrders);
router.get('/work-orders/:id', WorkOrderController.getWorkOrderById);
router.put('/work-orders/:id', WorkOrderController.updateWorkOrder);
router.delete('/work-orders/:id', WorkOrderController.deleteWorkOrder);

router.post('/repairs', RepairController.createRepairRecord);
router.get('/repairs', RepairController.getRepairRecords);
router.get('/repairs/:id', RepairController.getRepairRecordById);
router.put('/repairs/:id/processing', RepairController.markProcessing);
router.put('/repairs/:id/completed', RepairController.markCompleted);
router.put('/repairs/:id/return', RepairController.returnForRework);
router.put('/repairs/:id/release', RepairController.releaseRecord);
router.put('/repairs/:id/close', RepairController.closeLoop);
router.put('/repairs/:id/material', RepairController.requestMaterialSupplement);
router.get('/repairs/:id/report', RepairController.getFinalReport);
router.get('/export/repairs', RepairController.exportRecords);

router.post('/defects', DefectController.createDefect);
router.get('/defects', DefectController.getDefects);
router.get('/defects/statistics', DefectController.getDefectStatistics);
router.get('/defects/:id', DefectController.getDefectById);
router.put('/defects/:id', DefectController.updateDefect);
router.delete('/defects/:id', DefectController.deleteDefect);

router.get('/histories', HistoryController.getHistories);
router.post('/histories', HistoryController.addHistory);

router.post('/upload/repair-csv', upload.single('file'), FileUploadController.uploadRepairCSV);
router.post('/upload/workorder-json', upload.single('file'), FileUploadController.uploadWorkOrderJSON);
router.post('/upload/batch-json', upload.single('file'), FileUploadController.uploadBatchJSON);
router.get('/upload/template/:type', FileUploadController.getUploadTemplate);

module.exports = router;
