const express = require('express');
const router = express.Router();
const multer = require('multer');
const recordController = require('../controllers/recordController');
const csvController = require('../controllers/csvController');

const upload = multer({ storage: multer.memoryStorage() });

router.get('/records', recordController.search);
router.get('/records/check-expired', recordController.checkExpired);
router.get('/records/:id', recordController.getById);
router.post('/records', recordController.create);
router.put('/records/:id/status', recordController.updateStatus);

router.get('/csv/export', csvController.export);
router.post('/csv/import', upload.single('file'), csvController.import);

module.exports = router;
