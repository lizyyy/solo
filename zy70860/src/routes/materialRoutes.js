const express = require('express');
const multer = require('multer');
const MaterialController = require('../controllers/materialController');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.post('/records', MaterialController.createRecord);
router.post('/records/batch', MaterialController.createBatch);

router.put('/records/:recordId/processing', MaterialController.markProcessing);
router.put('/records/:recordId/approve', MaterialController.approveRecord);
router.put('/records/:recordId/reject', MaterialController.rejectRecord);
router.put('/records/:recordId/return', MaterialController.returnForRevision);
router.put('/records/:recordId/complete', MaterialController.completeRecord);
router.put('/records/:recordId/process-return', MaterialController.processReturn);

router.get('/records/:recordId', MaterialController.getRecord);
router.get('/records/:recordId/audit-trail', MaterialController.getRecordWithAuditTrail);
router.get('/records/:recordId/report', MaterialController.getCompleteReport);

router.get('/records', MaterialController.queryRecords);
router.get('/orders/:orderNumber/records', MaterialController.getByOrderNumber);
router.get('/teams/:teamName/records', MaterialController.getByTeamName);
router.get('/batches/:batchNumber/records', MaterialController.getByBatchNumber);

router.get('/exceptions', MaterialController.getExceptionLogs);

router.get('/statistics', MaterialController.getStatistics);

router.get('/export/csv', MaterialController.exportToCSV);
router.get('/export/report/:recordId', MaterialController.exportReport);

router.post('/import/vehicles', upload.single('file'), MaterialController.importVehicles);
router.post('/import/inventory', upload.single('file'), MaterialController.importInventory);
router.post('/import/records', upload.single('file'), MaterialController.importMaterialRecords);

module.exports = router;
