const express = require('express');
const router = express.Router();
const BatchController = require('../controllers/batchController');
const MaterialController = require('../controllers/materialController');
const ArchiveController = require('../controllers/archiveController');

router.post('/batches', BatchController.createBatch);
router.get('/batches/:id', BatchController.getBatch);

router.post('/materials/:id/process', MaterialController.processMaterial);
router.get('/materials/:id/trace', MaterialController.getMaterialTrace);

router.post('/archive', ArchiveController.triggerArchive);
router.get('/export/:batch_id', ArchiveController.exportReport);

router.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '疫苗预约改签API服务运行正常' });
});

module.exports = router;
