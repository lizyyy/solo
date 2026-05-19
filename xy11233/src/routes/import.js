const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const importService = require('../services/importService');
const logger = require('../config/logger');

const SYSTEM_OPERATOR = {
  id: 1,
  name: 'System',
  role: 'admin'
};

const uploadDir = path.join(__dirname, '../../uploads');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

router.post('/reagents', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '未上传文件' });
    }
    const operator = req.user || SYSTEM_OPERATOR;
    const fileType = path.extname(req.file.originalname).toLowerCase() === '.csv' ? 'csv' : 'json';
    const result = await importService.importReagents(req.file.path, operator, fileType);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('导入试剂失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/inventory', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '未上传文件' });
    }
    const operator = req.user || SYSTEM_OPERATOR;
    const fileType = path.extname(req.file.originalname).toLowerCase() === '.csv' ? 'csv' : 'json';
    const result = await importService.importInventory(req.file.path, operator, fileType);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('导入库存失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/requisitions', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '未上传文件' });
    }
    const operator = req.user || SYSTEM_OPERATOR;
    const result = await importService.importRequisitions(req.file.path, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('导入申领单失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/errors/:importId', async (req, res) => {
  try {
    const result = await importService.getImportErrors(req.params.importId);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('获取导入错误记录失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const result = await importService.listImports(req.query);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('获取导入记录失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
