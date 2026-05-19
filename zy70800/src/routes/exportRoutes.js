const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');

router.get('/critical-values', exportController.exportCriticalValues);
router.get('/processing-records', exportController.exportProcessingRecords);
router.get('/callbacks', exportController.exportCallbacks);

module.exports = router;
