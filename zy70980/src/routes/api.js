const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const recordController = require('../controllers/recordController');

const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname}`);
  }
});

const upload = multer({ storage });

router.get('/health', (req, res) => {
  res.json({ success: true, message: '市政运维服务运行正常', timestamp: new Date().toISOString() });
});

router.post('/batches', recordController.createBatch.bind(recordController));
router.get('/batches', recordController.listBatches.bind(recordController));
router.get('/batches/:batch_no', recordController.getBatch.bind(recordController));

router.post('/import/alarm-csv', upload.single('file'), recordController.importAlarmCSV.bind(recordController));
router.post('/import/inspection-json', recordController.importInspectionJSON.bind(recordController));
router.post('/import/work-order', recordController.importWorkOrder.bind(recordController));

router.get('/records', recordController.listRecords.bind(recordController));
router.get('/records/:record_no', recordController.getRecord.bind(recordController));
router.get('/records/:record_no/trace', recordController.getRecordTrace.bind(recordController));
router.get('/records/:record_no/history', recordController.getRecordHistory.bind(recordController));

router.post('/records/process', recordController.processRecord.bind(recordController));
router.post('/records/return', recordController.returnRecord.bind(recordController));

router.post('/special/multi-light', recordController.handleMultiLight.bind(recordController));
router.post('/special/false-alarm', recordController.filterFalseAlarm.bind(recordController));
router.post('/special/recheck', recordController.recheckRecord.bind(recordController));

router.get('/export/records', recordController.exportRecords.bind(recordController));
router.get('/export/records/:record_no/detail', recordController.exportRecordDetail.bind(recordController));
router.get('/export/recheck-trace', recordController.exportRecheckTrace.bind(recordController));

module.exports = router;
