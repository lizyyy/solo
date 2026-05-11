const express = require('express');
const router = express.Router();
const controller = require('../controllers/exchangeController');

router.post('/exchanges', controller.createExchangeRequest);
router.get('/exchanges', controller.listExchanges);
router.get('/exchanges/:exchangeId', controller.getExchangeDetail);
router.post('/exchanges/:exchangeId/return', controller.registerReturn);
router.post('/exchanges/:exchangeId/quality', controller.submitQualityCheck);
router.post('/exchanges/:exchangeId/difference', controller.handlePriceDifference);
router.post('/exchanges/:exchangeId/ship', controller.shipNewOrder);
router.post('/exchanges/:exchangeId/complete', controller.completeExchange);
router.post('/exchanges/:exchangeId/cancel', controller.cancelExchange);

router.get('/orders', controller.listOrders);
router.get('/orders/:orderId', controller.getOrderDetail);

router.get('/products', controller.listProducts);

router.get('/inventory', controller.listInventory);
router.get('/inventory/check', controller.checkInventoryAvailability);

router.get('/report', controller.getReport);

module.exports = router;
