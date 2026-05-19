const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ExportController = require('../controllers/exportController');

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
    cb(null, 'import-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || path.extname(file.originalname).toLowerCase() === '.csv') {
      cb(null, true);
    } else {
      cb(new Error('仅支持 CSV 文件'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.use((req, res, next) => {
  const userId = req.headers['x-user-id'];
  if (userId) {
    req.currentUserId = userId;
  }
  next();
});

router.post('/tasks', ExportController.createExport);
router.get('/tasks', ExportController.getTaskList);
router.get('/tasks/:id', ExportController.getTaskDetail);
router.post('/tasks/:id/retry', ExportController.retryTask);
router.post('/tasks/:id/correct', ExportController.correctAndRetry);
router.get('/tasks/:id/download', ExportController.downloadExport);
router.post('/tasks/:id/permission', ExportController.grantPermission);

router.post('/import', upload.single('file'), ExportController.importEvents);
router.get('/import/history', ExportController.getImportHistory);

router.get('/events', ExportController.getOperationEvents);
router.get('/users', ExportController.getUsers);

module.exports = router;
