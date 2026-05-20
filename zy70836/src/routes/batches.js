const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const batchService = require('../services/batchService');
const importService = require('../services/importService');
const queryService = require('../services/queryService');

const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

router.post('/', async (req, res) => {
  try {
    const { batch_name, operator } = req.body;
    if (!batch_name || !operator) {
      return res.status(400).json({ error: '批次名称和操作人不能为空' });
    }
    const result = await batchService.createBatch(batch_name, operator);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const result = await batchService.getBatchList(req.query);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await batchService.getBatchDetail(req.params.id);
    if (!result) {
      return res.status(404).json({ error: '批次不存在' });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/process', async (req, res) => {
  try {
    const { operator, remark } = req.body;
    if (!operator) {
      return res.status(400).json({ error: '操作人不能为空' });
    }
    await batchService.processBatch(req.params.id, operator, remark);
    res.json({ success: true, message: '批次处理完成' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/return', async (req, res) => {
  try {
    const { operator, reason } = req.body;
    if (!operator || !reason) {
      return res.status(400).json({ error: '操作人和退回原因不能为空' });
    }
    await batchService.returnBatchForRevision(req.params.id, operator, reason);
    res.json({ success: true, message: '已退回修改' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/import/borrow-return', upload.single('file'), async (req, res) => {
  try {
    const { operator } = req.body;
    if (!req.file || !operator) {
      return res.status(400).json({ error: '文件和操作人不能为空' });
    }
    const count = await importService.importBorrowReturnCSV(
      req.params.id, req.file.path, operator
    );
    res.json({ success: true, imported: count, message: `成功导入${count}条借还记录` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/import/vehicles', upload.single('file'), async (req, res) => {
  try {
    const { operator } = req.body;
    if (!req.file || !operator) {
      return res.status(400).json({ error: '文件和操作人不能为空' });
    }
    const count = await importService.importVehiclesJSON(
      req.params.id, req.file.path, operator
    );
    res.json({ success: true, imported: count, message: `成功导入${count}条车辆数据` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/import/violations', upload.single('file'), async (req, res) => {
  try {
    const { operator } = req.body;
    if (!req.file || !operator) {
      return res.status(400).json({ error: '文件和操作人不能为空' });
    }
    const count = await importService.importViolationReceipt(
      req.params.id, req.file.path, operator, req.file.filename
    );
    res.json({ success: true, imported: count, message: `成功导入${count}条违章记录` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;