const express = require('express');
const router = express.Router();
const discountController = require('../controllers/discountController');

router.get('/stalls/:stallId/history', discountController.getStallDiscountHistory);
router.get('/stalls/:stallId/:month', discountController.getStallDiscount);
router.post('/stalls/:stallId/recalculate', discountController.recalculateMonthlyDiscount);
router.post('/lock', discountController.lockMonthlyData);
router.get('/ranking', discountController.getRanking);
router.get('/config', discountController.getDiscountConfig);

module.exports = router;
