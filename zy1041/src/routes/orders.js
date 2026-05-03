const express = require('express');
const OrderController = require('../controllers/orderController');

const router = express.Router();

router.post('/lock', OrderController.lockOrder);
router.post('/confirm', OrderController.confirmOrder);
router.post('/pickup', OrderController.pickupItem);
router.post('/deliver', OrderController.deliverItem);
router.post('/cancel', OrderController.cancelOrder);
router.post('/dispute', OrderController.raiseDispute);
router.get('/', OrderController.listOrders);
router.get('/:order_id', OrderController.getOrderStatus);

module.exports = router;
