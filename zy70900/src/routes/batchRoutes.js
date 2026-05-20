const express = require('express');
const multer = require('multer');
const path = require('path');
const batchController = require('../controllers/batchController');

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

router.post('/create', batchController.createBatch);
router.post('/import/inspection', upload.single('file'), batchController.importInspectionCSV);
router.post('/import/sensor', upload.single('file'), batchController.importSensorJSON);
router.post('/import/approval', upload.single('file'), batchController.importApprovalCSV);

module.exports = router;
