const express = require('express');
const router = express.Router();
const { BillController } = require('../controllers');
const { Validation } = require('../middlewares');

// 获取所有账单
router.get('/', BillController.getAll);

// 获取余额汇总
router.get('/balance/summary', BillController.getBalanceSummary);

// 获取室友对账单
router.get('/statement/:flatmate_id', BillController.getFlatmateStatement);

// 根据ID获取账单
router.get('/:id', BillController.getById);

// 创建账单
router.post('/', 
  Validation.validateBillCreate,
  BillController.create
);

// 更新账单
router.put('/:id', BillController.update);

// 删除账单
router.delete('/:id', BillController.delete);

// 获取账单的分摊规则
router.get('/:bill_id/split-rules', BillController.getSplitRules);

// 获取账单的付款记录
router.get('/:bill_id/payments', BillController.getPayments);

module.exports = router;
