const express = require('express');
const router = express.Router();
const { asyncHandler, requireOperator } = require('../middleware/errorHandler');
const controller = require('../controllers/reportController');

router.post('/repair', requireOperator, asyncHandler(controller.generateRepairReport));
router.post('/rating', requireOperator, asyncHandler(controller.generateRatingReport));
router.post('/comprehensive', requireOperator, asyncHandler(controller.generateComprehensiveReport));
router.get('/:reportId/trace', asyncHandler(controller.getFullTraceFromReport));
router.get('/:reportId/export', requireOperator, asyncHandler(controller.exportReportData));
router.get('/:reportId', asyncHandler(controller.getReport));
router.get('/', asyncHandler(controller.listReports));

module.exports = router;
