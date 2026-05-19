const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const batchController = require('../controllers/batchController');
const materialController = require('../controllers/materialController');
const processingController = require('../controllers/processingController');
const exportController = require('../controllers/exportController');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

router.get('/batches', batchController.getBatches);
router.get('/batches/:id', batchController.getBatchById);
router.post('/batches', batchController.createBatch);

router.get('/materials', materialController.getMaterials);
router.post('/materials/upload', upload.single('file'), materialController.uploadMaterial);
router.post('/materials/register', materialController.registerMaterial);

router.post('/processing/trigger', processingController.triggerProcessing);
router.get('/details', processingController.getDetails);
router.get('/details/:id', processingController.getDetail);
router.put('/details/:id/category', processingController.updateDetailCategory);

router.get('/exports', exportController.exportBatchReport);
router.get('/exports/download/:filename', exportController.downloadReport);

router.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '消防维保提醒API运行正常' });
});

module.exports = router;
