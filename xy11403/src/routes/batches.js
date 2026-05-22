const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { BatchService, DUPLICATE_STRATEGIES } = require('../services/batchService');
const { AdjustmentService, FreezeService } = require('../services/adjustmentService');
const { ExportService, HistoryService } = require('../services/exportService');
const { PhotoDAO } = require('../db/dao');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../data/uploads');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

router.post('/submit', async (req, res) => {
  try {
    const { duplicate_strategy, operator, ...submitData } = req.body;
    const strategy = Object.values(DUPLICATE_STRATEGIES).includes(duplicate_strategy)
      ? duplicate_strategy
      : DUPLICATE_STRATEGIES.ERROR;

    const result = await BatchService.submitBatch(submitData, strategy, operator || 'api_user');
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:batchId/withdraw', (req, res) => {
  try {
    const { operator, reason } = req.body;
    const result = BatchService.withdrawBatch(
      parseInt(req.params.batchId),
      operator || 'api_user',
      reason
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/resubmit/:batchNo', async (req, res) => {
  try {
    const { operator, ...submitData } = req.body;
    const result = BatchService.resubmitAfterWithdraw(
      req.params.batchNo,
      submitData,
      operator || 'api_user'
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/', (req, res) => {
  const batches = BatchService.getAllBatches();
  res.json({ success: true, data: batches });
});

router.get('/:batchId', (req, res) => {
  const detail = BatchService.getBatchDetail(parseInt(req.params.batchId));
  if (!detail) {
    return res.status(404).json({ success: false, error: '批次不存在' });
  }
  res.json({ success: true, data: detail });
});

router.post('/:batchId/adjust/compensation', (req, res) => {
  try {
    const { box_no, new_compensation, reason, operator } = req.body;
    const result = AdjustmentService.adjustCompensation(
      parseInt(req.params.batchId),
      box_no,
      parseFloat(new_compensation),
      reason,
      operator || 'api_user'
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:batchId/adjust/status', (req, res) => {
  try {
    const { box_no, new_status, reason, operator } = req.body;
    const result = AdjustmentService.adjustBoxStatus(
      parseInt(req.params.batchId),
      box_no,
      new_status,
      reason,
      operator || 'api_user'
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:batchId/freeze', (req, res) => {
  try {
    const { operator } = req.body;
    const result = FreezeService.freezeBatch(
      parseInt(req.params.batchId),
      operator || 'api_user'
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:batchId/unfreeze', (req, res) => {
  try {
    const { operator } = req.body;
    const result = FreezeService.unfreezeBatch(
      parseInt(req.params.batchId),
      operator || 'api_user'
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:batchId/export', async (req, res) => {
  try {
    const result = await ExportService.exportBatchDetail(parseInt(req.params.batchId));
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/exports/list', (req, res) => {
  const list = ExportService.getExportList();
  res.json({ success: true, data: list });
});

router.get('/:batchId/history', (req, res) => {
  const history = HistoryService.getOperationHistory(parseInt(req.params.batchId));
  res.json({ success: true, data: history });
});

router.get('/:batchId/history/summary', (req, res) => {
  const summary = HistoryService.getHistorySummary(parseInt(req.params.batchId));
  res.json({ success: true, data: summary });
});

router.get('/history/all', (req, res) => {
  const history = HistoryService.getAllHistory();
  res.json({ success: true, data: history });
});

router.get('/:batchId/replay', (req, res) => {
  try {
    const rawData = ExportService.getRawDataForReplay(parseInt(req.params.batchId));
    res.json({ success: true, data: rawData });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:batchId/photo/upload', upload.single('photo'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '未上传文件' });
    }

    const { photo_type, remark } = req.body;
    const photoId = PhotoDAO.create({
      batch_id: parseInt(req.params.batchId),
      photo_type: photo_type || 'driver',
      file_name: req.file.originalname,
      file_path: req.file.path,
      file_size: req.file.size,
      remark
    });

    res.json({
      success: true,
      photo_id: photoId,
      file: {
        original_name: req.file.originalname,
        saved_path: req.file.path,
        size: req.file.size
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
