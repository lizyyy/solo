const express = require('express');
const router = express.Router();
const RebateController = require('../controllers/rebateController');

router.post('/', RebateController.createRebateOrder);
router.get('/', RebateController.getRebateOrders);
router.get('/:id', RebateController.getRebateOrderDetail);
router.post('/:id/submit', RebateController.submitRebateOrder);
router.post('/:id/revoke', RebateController.revokeRebateOrder);
router.post('/:id/manual', RebateController.manualProcess);
router.post('/:id/return-adjustment', RebateController.addReturnAdjustment);
router.get('/:id/check-deduction', RebateController.checkReturnDeduction);

module.exports = router;
