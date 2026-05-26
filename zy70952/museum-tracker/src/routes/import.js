const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const importService = require('../services/importService');
const { success, fail } = require('../utils/response');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.resolve(__dirname, '..', '..', 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    cb(null, `${timestamp}_${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'csv' && !file.originalname.toLowerCase().endsWith('.csv')) {
      return cb(new Error('只接受 CSV 文件'));
    }
    if (file.fieldname === 'json' && !file.originalname.toLowerCase().endsWith('.json')) {
      return cb(new Error('只接受 JSON 文件'));
    }
    cb(null, true);
  }
});

router.post('/artifacts/csv', upload.single('csv'), async (req, res) => {
  try {
    if (!req.file) return fail(res, '请上传 CSV 文件', 400);
    const operator = req.headers['x-operator'] || 'system';
    const result = await importService.importArtifactsFromCsv(req.file.path, operator);
    success(res, result, `CSV 导入完成: 新增 ${result.imported} 件, 更新 ${result.updated} 件`);
  } catch (e) {
    fail(res, e.message, 400);
  }
});

router.post('/transport/json', upload.single('json'), async (req, res) => {
  try {
    if (!req.file) return fail(res, '请上传 JSON 文件', 400);
    const operator = req.headers['x-operator'] || 'system';
    const result = await importService.importTransportFromJson(req.file.path, operator);
    success(res, result, `运输 JSON 导入完成: ${result.imported} 条`);
  } catch (e) {
    fail(res, e.message, 400);
  }
});

router.post('/insurance/json', upload.single('json'), async (req, res) => {
  try {
    if (!req.file) return fail(res, '请上传 JSON 文件', 400);
    const operator = req.headers['x-operator'] || 'system';
    const result = await importService.importInsuranceFromJson(req.file.path, operator);
    success(res, result, `保险 JSON 导入完成: ${result.imported} 条`);
  } catch (e) {
    fail(res, e.message, 400);
  }
});

module.exports = router;
