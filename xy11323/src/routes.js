const express = require('express');
const router = express.Router();
const {
  upload,
  importWorkOrdersController,
  importFuelRecordsController,
  importRateConfigsController
} = require('./controllers/importController');
const {
  getAllBatches,
  getBatchById,
  getWorkOrders,
  getFuelRecords,
  getRateConfigs,
  getErrorRecords,
  updateWorkOrder,
  approveWorkOrder,
  fixErrorRecord,
  exportWorkOrders,
  getOperationLogs
} = require('./controllers/recordController');

router.post('/import/work-orders', upload.single('file'), importWorkOrdersController);
router.post('/import/fuel-records', upload.single('file'), importFuelRecordsController);
router.post('/import/rate-configs', upload.single('file'), importRateConfigsController);

router.get('/batches', getAllBatches);
router.get('/batches/:id', getBatchById);

router.get('/work-orders', getWorkOrders);
router.put('/work-orders/:id', updateWorkOrder);
router.post('/work-orders/:id/approve', approveWorkOrder);
router.get('/work-orders/export', exportWorkOrders);

router.get('/fuel-records', getFuelRecords);
router.get('/rate-configs', getRateConfigs);
router.get('/error-records', getErrorRecords);
router.post('/error-records/:id/fix', fixErrorRecord);

router.get('/operation-logs', getOperationLogs);

module.exports = router;