const express = require('express');
const router = express.Router();
const { asyncHandler, requireOperator } = require('../middleware/errorHandler');
const controller = require('../controllers/batchController');

router.post('/create', requireOperator, asyncHandler(controller.createBatch));
router.post('/confirm', requireOperator, asyncHandler(controller.confirmBatch));
router.post('/void', requireOperator, asyncHandler(controller.voidBatch));
router.get('/:batchId', asyncHandler(controller.getBatch));
router.get('/', asyncHandler(controller.listBatches));

module.exports = router;
