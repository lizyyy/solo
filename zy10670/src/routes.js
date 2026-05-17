const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { STATUS, STATUS_LABELS } = require('./db');
const meterService = require('./services/meterService');
const importExportService = require('./services/importExportService');

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'import-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

router.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '园区能耗系统异常电表复核 API 运行正常' });
});

router.get('/status', (req, res) => {
  res.json({
    status: Object.keys(STATUS).map(k => ({
      key: STATUS[k],
      label: STATUS_LABELS[STATUS[k]]
    }))
  });
});

router.post('/meters', async (req, res) => {
  try {
    const meter = await meterService.createMeter(req.body);
    res.json({ success: true, data: meter });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/meters', async (req, res) => {
  try {
    const meters = await meterService.getAllMeters();
    res.json({ success: true, data: meters });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/meters/:id', async (req, res) => {
  try {
    const meter = await meterService.getMeterById(req.params.id);
    res.json({ success: true, data: meter });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/meters/:oldNo/replace', async (req, res) => {
  try {
    const meter = await meterService.replaceMeter(req.params.oldNo, req.body);
    res.json({ success: true, data: meter });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/readings', async (req, res) => {
  try {
    const result = await meterService.addReading(
      req.body.meter_id,
      req.body.reading_value,
      req.body.reading_time,
      req.body.collector
    );
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/meters/:meterId/readings', async (req, res) => {
  try {
    const readings = await meterService.getReadingByMeter(req.params.meterId);
    res.json({ success: true, data: readings });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/readings/:id/correct', async (req, res) => {
  try {
    const result = await meterService.correctReading(
      req.params.id,
      req.body.new_value,
      req.body.note,
      req.body.reviewed_by
    );
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/reviews', async (req, res) => {
  try {
    const reviews = await meterService.getReviewList(req.query);
    res.json({ success: true, data: reviews });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/reviews/:id', async (req, res) => {
  try {
    const review = await meterService.getReviewDetail(req.params.id);
    res.json({ success: true, data: review });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.put('/reviews/:id/status', async (req, res) => {
  try {
    const result = await meterService.updateReviewStatus(
      req.params.id,
      req.body.status,
      req.body.note,
      req.body.reviewed_by
    );
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '请上传文件' });
    }
    const batchNo = 'BATCH-' + Date.now();
    const result = await importExportService.importReadingsFromCsv(req.file.path, batchNo);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/import/batches', async (req, res) => {
  try {
    const batches = await importExportService.getImportBatchList();
    res.json({ success: true, data: batches });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/import/batches/:batchNo', async (req, res) => {
  try {
    const batch = await importExportService.getImportBatchDetail(req.params.batchNo);
    res.json({ success: true, data: batch });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/export/reviews', async (req, res) => {
  try {
    const result = await importExportService.exportReviewsToCsv(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/exports/:filename', (req, res) => {
  const filePath = path.join(__dirname, '../exports', req.params.filename);
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).json({ success: false, error: '文件不存在' });
  }
});

module.exports = router;
