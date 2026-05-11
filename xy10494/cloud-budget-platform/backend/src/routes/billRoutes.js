const express = require('express');
const multer = require('multer');
const path = require('path');
const billController = require('../controllers/billController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /csv|xlsx|xls/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    if (extname) {
      cb(null, true);
    } else {
      cb(new Error('仅支持 CSV 和 Excel 文件'));
    }
  },
});

router.use(authMiddleware);

router.get('/imports', billController.getBillImports);
router.get('/imports/:id', billController.getBillImportById);
router.get('/records', billController.getBillRecords);
router.get('/records/:id', billController.getBillRecordById);

router.use(roleMiddleware('admin', 'finance'));

router.post('/import', upload.single('file'), billController.importBill);
router.post('/records/:id/assign', billController.manualAssign);

module.exports = router;
