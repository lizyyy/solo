const express = require('express');
const router = express.Router();
const batchController = require('./controllers/batchController');

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

router.post('/batches', asyncHandler(batchController.submitBatch));
router.get('/batches', asyncHandler(batchController.listBatches));
router.get('/batches/:batchNo', asyncHandler(batchController.getBatch));
router.get('/statistics', asyncHandler(batchController.getStats));
router.get('/export/batch/:batchNo', asyncHandler(batchController.exportBatch));
router.get('/export/statistics', asyncHandler(batchController.exportStats));
router.get('/export/download/:filename', batchController.downloadExport);

module.exports = router;
