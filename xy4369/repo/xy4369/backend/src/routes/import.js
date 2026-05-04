const express = require('express');
const router = express.Router();
const multer = require('multer');
const { importRopeLedger, importUsageRecords, importManufacturerThresholds } = require('../utils/importUtils');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.csv', '.json', '.txt'];
    const ext = require('path').extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext) || file.mimetype === 'text/csv' || file.mimetype === 'application/json') {
      cb(null, true);
    } else {
      cb(new Error('只允许上传 CSV 或 JSON 文件'), false);
    }
  }
});

router.post('/ropes', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请上传文件'
      });
    }
    
    const result = await importRopeLedger(req.file.buffer);
    
    res.json({
      success: true,
      data: {
        type: 'rope_ledger',
        ...result
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/usage', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请上传文件'
      });
    }
    
    const result = await importUsageRecords(req.file.buffer);
    
    res.json({
      success: true,
      data: {
        type: 'usage_records',
        ...result
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/thresholds', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请上传文件'
      });
    }
    
    const result = await importManufacturerThresholds(req.file.buffer);
    
    res.json({
      success: true,
      data: {
        type: 'manufacturer_thresholds',
        ...result
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
