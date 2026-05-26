const express = require('express');
const router = express.Router();
const { asyncHandler, requireOperator } = require('../middleware/errorHandler');
const controller = require('../controllers/ratingController');

router.post('/create', requireOperator, asyncHandler(controller.createRating));
router.post('/mark-malicious', requireOperator, asyncHandler(controller.markMalicious));
router.post('/unmark-malicious', requireOperator, asyncHandler(controller.unmarkMalicious));
router.post('/check-malicious', asyncHandler(controller.checkMaliciousPattern));
router.get('/by-request/:requestId', asyncHandler(controller.getRatingsByRequest));
router.get('/by-worker/:workerId', asyncHandler(controller.getRatingsByWorker));
router.get('/:ratingId', asyncHandler(controller.getRatingDetail));

module.exports = router;
