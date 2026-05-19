const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const logger = require('../config/logger');
const ImportService = require('../services/ImportService');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || path.extname(file.originalname).toLowerCase() === '.csv') {
      cb(null, true);
    } else {
      cb(new Error('只允许上传 CSV 文件'));
    }
  }
});

router.post('/visitor', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传文件' });
    }
    
    const result = await ImportService.importFromCSV(
      req.file.path,
      'visitor',
      req.file.originalname,
      req.user?.username || 'system'
    );
    
    res.json({
      success: true,
      message: `导入完成，共 ${result.total} 条记录`,
      data: result
    });
  } catch (error) {
    logger.error('Import visitor error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/temporary-plate', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传文件' });
    }
    
    const result = await ImportService.importFromCSV(
      req.file.path,
      'temporary_plate',
      req.file.originalname,
      req.user?.username || 'system'
    );
    
    res.json({
      success: true,
      message: `导入完成，共 ${result.total} 条记录`,
      data: result
    });
  } catch (error) {
    logger.error('Import plate error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/blacklist', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传文件' });
    }
    
    const result = await ImportService.importFromCSV(
      req.file.path,
      'blacklist',
      req.file.originalname,
      req.user?.username || 'system'
    );
    
    res.json({
      success: true,
      message: `导入完成，共 ${result.total} 条记录`,
      data: result
    });
  } catch (error) {
    logger.error('Import blacklist error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/batches', async (req, res) => {
  try {
    const filters = {
      batchType: req.query.type,
      status: req.query.status
    };
    
    const batches = await ImportService.getAllBatches(filters);
    res.json({ success: true, data: batches });
  } catch (error) {
    logger.error('Get batches error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/batch/:id', async (req, res) => {
  try {
    const batch = await ImportService.getBatchStatus(req.params.id);
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }
    res.json({ success: true, data: batch });
  } catch (error) {
    logger.error('Get batch error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
