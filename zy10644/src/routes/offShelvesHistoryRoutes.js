const express = require('express');
const router = express.Router();
const {
  getHistoryList,
  getHistoryByBatchId,
  getHistoryBySku,
  exportHistory,
  importBatchOffShelves
} = require('../controllers/offShelvesHistoryController');

router.get('/', getHistoryList);
router.get('/batch/:batchId', getHistoryByBatchId);
router.get('/sku/:sku', getHistoryBySku);
router.get('/export', exportHistory);
router.post('/import', importBatchOffShelves);

module.exports = router;
