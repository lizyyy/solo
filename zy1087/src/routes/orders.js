const express = require('express');
const { body, param, query } = require('express-validator');
const orderController = require('../controllers/orderController');
const { authenticate } = require('../middleware/auth');
const { validate, validateId } = require('../middleware/validate');

const router = express.Router();

const listOrdersValidators = [
  query('status')
    .optional()
    .isString().withMessage('状态必须是字符串'),
  query('role')
    .optional()
    .isIn(['buyer', 'seller']).withMessage('角色必须是buyer或seller'),
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('页码必须是大于0的整数'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('每页数量必须是1-100之间的整数'),
  validate
];

const getOrderValidators = [
  param('id')
    .custom(validateId),
  validate
];

const createOrderValidators = [
  body('product_id')
    .notEmpty().withMessage('商品ID不能为空')
    .custom(validateId),
  body('final_price')
    .optional()
    .isFloat({ min: 0.01 }).withMessage('价格必须大于0'),
  body('notes')
    .optional()
    .isLength({ max: 500 }).withMessage('备注不能超过500个字符'),
  validate
];

const confirmDepositValidators = [
  param('id')
    .custom(validateId),
  body('payment_method')
    .optional()
    .isIn(['wechat', 'alipay', 'bank_transfer', 'cash', 'other']).withMessage('支付方式无效'),
  body('transaction_id')
    .optional()
    .isString().withMessage('交易号必须是字符串'),
  validate
];

const shipOrderValidators = [
  param('id')
    .custom(validateId),
  body('logistics_company')
    .optional()
    .isString().withMessage('物流公司必须是字符串'),
  body('tracking_number')
    .optional()
    .isString().withMessage('运单号必须是字符串'),
  validate
];

const submitInspectionValidators = [
  param('id')
    .custom(validateId),
  body('overall_result')
    .notEmpty().withMessage('整体结果不能为空')
    .isIn(['pass', 'partial', 'fail']).withMessage('整体结果必须是pass、partial或fail'),
  body('items')
    .optional()
    .isArray().withMessage('验货项必须是数组'),
  body('notes')
    .optional()
    .isString().withMessage('备注必须是字符串'),
  validate
];

router.get('/', authenticate, listOrdersValidators, orderController.getOrders);
router.get('/:id', authenticate, getOrderValidators, orderController.getOrderById);
router.post('/', authenticate, createOrderValidators, orderController.createOrder);
router.post('/:id/confirm-deposit', authenticate, confirmDepositValidators, orderController.confirmDeposit);
router.post('/:id/ship', authenticate, shipOrderValidators, orderController.shipOrder);
router.post('/:id/start-inspection', authenticate, getOrderValidators, orderController.startInspection);
router.post('/:id/submit-inspection', authenticate, submitInspectionValidators, orderController.submitInspection);
router.post('/:id/confirm-release', authenticate, getOrderValidators, orderController.confirmRelease);
router.post('/:id/cancel', authenticate, getOrderValidators, orderController.cancelOrder);

module.exports = router;
