const express = require('express');
const router = express.Router();
const { asyncHandler, requireOperator } = require('../middleware/errorHandler');
const controller = require('../controllers/appealController');

router.post('/submit', requireOperator, asyncHandler(controller.submitAppeal));
router.post('/review', requireOperator, asyncHandler(controller.reviewAppeal));
router.get('/:appealId', asyncHandler(controller.getAppealDetail));
router.get('/', asyncHandler(controller.listAppeals));

module.exports = router;
