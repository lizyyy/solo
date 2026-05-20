const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const borrowController = require('../controllers/borrowController');
const importController = require('../controllers/importController');
const queryController = require('../controllers/queryController');

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
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
    const allowedTypes = ['.csv', '.json'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('只支持CSV和JSON格式文件'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '档案室管理系统API运行正常',
    timestamp: new Date().toLocaleString('zh-CN'),
    uptime: process.uptime()
  });
});

router.post('/batch/create', borrowController.createBatch);
router.get('/batch/list', queryController.getBatchList);

router.post('/borrow/mark-processed', borrowController.markProcessed);
router.post('/borrow/return-modify', borrowController.returnModify);
router.post('/borrow/approve-release', borrowController.approveAndRelease);
router.post('/borrow/overdue-reminder', borrowController.sendOverdueReminder);
router.post('/borrow/renew', borrowController.renewRecord);
router.get('/borrow/detail/:recordId', borrowController.getRecordDetail);
router.post('/borrow/export', borrowController.exportDetails);

router.post('/import/borrow-csv', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '请上传文件' });
    }
    const result = await importController.importBorrowCSV(req.file.path, req.body.operator);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: '导入失败', error: error.message });
  }
});

router.post('/import/case-json', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '请上传文件' });
    }
    const result = await importController.importCaseJSON(req.file.path, req.body.operator);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: '导入失败', error: error.message });
  }
});

router.post('/import/permission-csv', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '请上传文件' });
    }
    const result = await importController.importPermissionCSV(req.file.path, req.body.operator);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: '导入失败', error: error.message });
  }
});

router.post('/query/history', queryController.queryHistory);
router.get('/query/statistics', queryController.getStatistics);
router.post('/query/operation-logs', queryController.getOperationLogs);

module.exports = router;
