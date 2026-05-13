const express = require('express');
const router = express.Router();
const { getRechargeOrders, createRecharge } = require('../controllers/rechargeController');
const { checkCardStatus, checkIdempotency } = require('../middleware/businessRules');
const { auditLog } = require('../middleware/audit');

router.get('/', getRechargeOrders);
router.post('/', checkCardStatus, checkIdempotency('recharge_orders'), auditLog('create', 'recharge'), createRecharge);

module.exports = router;
