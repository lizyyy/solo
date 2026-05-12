const express = require('express');
const router = express.Router();
const OrderController = require('../controllers/orderController');
const getIdempotencyMiddleware = require('../middleware/idempotency');

const idempotency = getIdempotencyMiddleware();

router.post('/', idempotency, OrderController.create);
router.get('/:id', OrderController.getById);
router.get('/', OrderController.list);

module.exports = router;
