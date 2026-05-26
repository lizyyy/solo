const express = require('express');
const router = express.Router();
const { asyncHandler, requireOperator } = require('../middleware/errorHandler');
const controller = require('../controllers/repairController');

router.post('/assign', requireOperator, asyncHandler(controller.assignWorker));
router.post('/process', requireOperator, asyncHandler(controller.markProcessing));
router.post('/complete', requireOperator, asyncHandler(controller.completeRepair));
router.post('/return', requireOperator, asyncHandler(controller.returnForRevision));
router.post('/close', requireOperator, asyncHandler(controller.closeRepair));
router.get('/:requestId/logs', asyncHandler(controller.getRepairLogs));
router.get('/:requestId', asyncHandler(controller.getRepairDetail));
router.get('/', asyncHandler(controller.listRepairs));

module.exports = router;
