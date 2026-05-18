const express = require('express');
const multer = require('multer');
const router = express.Router();
const upload = multer({ dest: 'uploads/' });

const importController = require('./controllers/importController');
const recordController = require('./controllers/recordController');
const exportController = require('./controllers/exportController');
const migrationController = require('./controllers/migrationController');

router.post('/import/csv', upload.single('file'), importController.importCSV);
router.get('/import/batches', importController.getImportBatches);
router.get('/import/bad-records/:batchNo', importController.getBadRecords);

router.get('/records', recordController.getRecords);
router.get('/records/:id', recordController.getRecordById);
router.post('/records', recordController.createRecord);
router.put('/records/:id/status', recordController.updateRecordStatus);
router.post('/records/:id/manual-review', recordController.manualReviewAndProceed);
router.get('/records/:id/logs', recordController.getStatusLogs);
router.get('/summary', recordController.getSummary);

router.get('/export/excel', exportController.exportExcel);
router.get('/export/csv', exportController.exportCSV);

router.post('/migration/migrate', migrationController.migrateHistoricalData);
router.get('/migration/records', migrationController.getMigrationRecords);
router.get('/migration/comparison/:old_system_id', migrationController.getMigrationComparison);

module.exports = router;