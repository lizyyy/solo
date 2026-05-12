const express = require('express');
const router = express.Router();
const ExchangeController = require('../controllers/exchangeController');
const getIdempotencyMiddleware = require('../middleware/idempotency');

const idempotency = getIdempotencyMiddleware();

router.post('/', idempotency, ExchangeController.create);
router.post('/:id/confirm', ExchangeController.confirm);
router.get('/order/:orderId', ExchangeController.getByOrderId);

module.exports = router;
