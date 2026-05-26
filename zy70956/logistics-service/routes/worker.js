const express = require('express');
const router = express.Router();
const { asyncHandler, requireOperator } = require('../middleware/errorHandler');
const controller = require('../controllers/workerController');

router.get('/:workerId', asyncHandler(controller.getWorker));
router.put('/', requireOperator, asyncHandler(controller.updateWorker));
router.get('/', asyncHandler(controller.listWorkers));

module.exports = router;
