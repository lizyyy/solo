const express = require('express');
const router = express.Router();
const multer = require('multer');
const config = require('../config');
const fs = require('fs');

const uploadDir = config.upload.dir;
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({ dest: uploadDir });

const ImportController = require('../controllers/importController');
const LossController = require('../controllers/lossController');
const QueueController = require('../controllers/queueController');
const ExportController = require('../controllers/exportController');

router.get('/health', (req, res) => {
  res.json({ success: true, message: '生鲜分拣损耗重试补偿队列服务运行中', timestamp: new Date().toISOString() });
});

router.post('/import/upload', upload.single('file'), ImportController.uploadImport);
router.get('/import/batches', ImportController.listBatches);
router.get('/import/batches/:batchId', ImportController.getBatch);

router.post('/loss/bad-fruit', LossController.calculateBadFruit);
router.post('/loss/secondary-sorting', LossController.calculateSecondarySorting);
router.post('/loss/process-delivery/:deliveryNo', LossController.processDelivery);
router.get('/loss/records', LossController.listLossRecords);
router.get('/loss/records/:id', LossController.getLossRecord);
router.get('/loss/summary', LossController.getLossSummary);

router.post('/queue/jobs', QueueController.addJob);
router.get('/queue/jobs', QueueController.listJobs);
router.get('/queue/jobs/:queueId', QueueController.getJob);
router.get('/queue/stats', QueueController.getStats);
router.post('/queue/jobs/:queueId/manual-handle', QueueController.manualHandle);
router.post('/queue/jobs/:queueId/submit-receipt', QueueController.submitReceipt);
router.post('/queue/jobs/:queueId/mark-waiting-manual', QueueController.markWaitingManual);

router.get('/export/retryable', ExportController.exportRetryable);
router.get('/export/dead-letter', ExportController.exportDeadLetter);
router.get('/export/queue/:status', ExportController.exportQueueByStatus);
router.get('/export/loss-records', ExportController.exportLossRecords);
router.get('/export/import-batches', ExportController.exportImportBatches);
router.get('/export/download/:fileName', ExportController.downloadFile);

module.exports = router;
