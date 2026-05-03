const express = require('express');
const router = express.Router();
const { PaymentController } = require('../controllers');
const { Validation } = require('../middlewares');

// 获取所有付款记录
router.get('/', PaymentController.getAll);

// 获取我的付款记录
router.get('/my', PaymentController.getMyPayments);

// 获取待我确认的付款
router.get('/to-confirm', PaymentController.getPaymentsToConfirm);

// 根据ID获取付款记录
router.get('/:id', PaymentController.getById);

// 创建付款记录
router.post('/', 
  Validation.validatePaymentCreate,
  PaymentController.create
);

// 确认付款
router.post('/confirm', 
  Validation.validatePaymentConfirm,
  PaymentController.confirm
);

// 拒绝付款
router.post('/:id/reject', PaymentController.reject);

module.exports = router;
