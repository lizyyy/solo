const express = require('express');
const router = express.Router();
const { asyncHandler, requireOperator } = require('../middleware/errorHandler');
const controller = require('../controllers/queryController');

router.get('/buildings', asyncHandler(controller.getBuildings));
router.get('/building/:building/export', requireOperator, asyncHandler(controller.exportByBuilding));
router.get('/building/:building', asyncHandler(controller.queryByBuilding));
router.get('/worker/:workerId/export', requireOperator, asyncHandler(controller.exportByWorker));
router.get('/worker/:workerId', asyncHandler(controller.queryByWorker));
router.get('/appeal/:appealStatus/export', requireOperator, asyncHandler(controller.exportAppeals));
router.get('/appeal/:appealStatus', asyncHandler(controller.queryByAppeal));
router.get('/trace/:recordType/:recordId', asyncHandler(controller.traceRecord));

module.exports = router;
