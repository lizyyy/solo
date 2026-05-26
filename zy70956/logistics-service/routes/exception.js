const express = require('express');
const router = express.Router();
const { asyncHandler, requireOperator } = require('../middleware/errorHandler');
const controller = require('../controllers/exceptionController');

router.post('/duplicate/mark', requireOperator, asyncHandler(controller.markDuplicate));
router.post('/duplicate/unmark', requireOperator, asyncHandler(controller.unmarkDuplicate));
router.post('/duplicate/scan', asyncHandler(controller.scanDuplicates));
router.post('/overtime/penalize', requireOperator, asyncHandler(controller.penalizeOvertime));
router.get('/overtime/scan', asyncHandler(controller.scanOvertime));
router.get('/summary', asyncHandler(controller.getExceptionSummary));

module.exports = router;
