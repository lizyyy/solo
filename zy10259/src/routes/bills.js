const express = require('express');
const router = express.Router();
const BillController = require('../controllers/billController');

router.get('/order/:orderId', BillController.getByOrderId);
router.post('/:id/pay', BillController.pay);
router.get('/', BillController.list);

module.exports = router;
