const express = require('express');
const router = express.Router();
const DepositController = require('../controllers/depositController');
const getIdempotencyMiddleware = require('../middleware/idempotency');

const idempotency = getIdempotencyMiddleware();

router.post('/pay', idempotency, DepositController.pay);
router.post('/deduct', idempotency, DepositController.deduct);
router.post('/refund', idempotency, DepositController.refund);
router.get('/order/:orderId', DepositController.getByOrderId);

module.exports = router;
