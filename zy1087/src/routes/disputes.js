const express = require('express');
const { body, param, query } = require('express-validator');
const disputeController = require('../controllers/disputeController');
const { authenticate } = require('../middleware/auth');
const { validate, validateId } = require('../middleware/validate');

const router = express.Router();

const raiseDisputeValidators = [
  body('order_id')
    .notEmpty().withMessage('订单ID不能为空')
    .custom(validateId),
  body('reason')
    .notEmpty().withMessage('争议原因不能为空')
    .isLength({ min: 10, max: 2000 }).withMessage('争议原因长度应在10-2000个字符之间'),
  body('evidence_urls')
    .optional()
    .isArray().withMessage('证据URL必须是数组'),
  validate
];

const listDisputesValidators = [
  query('status')
    .optional()
    .isIn(['open', 'processing', 'resolved', 'closed']).withMessage('状态无效'),
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('页码必须是大于0的整数'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('每页数量必须是1-100之间的整数'),
  validate
];

const getDisputeValidators = [
  param('id')
    .custom(validateId),
  validate
];

const updateDisputeValidators = [
  param('id')
    .custom(validateId),
  body('reason')
    .optional()
    .isLength({ min: 10, max: 2000 }).withMessage('争议原因长度应在10-2000个字符之间'),
  body('evidence_urls')
    .optional()
    .isArray().withMessage('证据URL必须是数组'),
  body('suggestion')
    .optional()
    .isString().withMessage('处理建议必须是字符串'),
  validate
];

const resolveDisputeValidators = [
  param('id')
    .custom(validateId),
  body('resolution')
    .notEmpty().withMessage('处理结果不能为空')
    .isIn(['release', 'partial_refund', 'close']).withMessage('处理结果无效'),
  body('responsibility')
    .optional()
    .isIn(['buyer', 'seller', 'mutual', 'undecided']).withMessage('责任归属无效'),
  body('refund_amount')
    .optional()
    .isFloat({ min: 0 }).withMessage('退款金额必须是非负数'),
  validate
];

router.get('/', authenticate, listDisputesValidators, disputeController.getDisputes);
router.get('/:id', authenticate, getDisputeValidators, disputeController.getDisputeById);
router.post('/', authenticate, raiseDisputeValidators, disputeController.raiseDispute);
router.put('/:id', authenticate, updateDisputeValidators, disputeController.updateDispute);
router.post('/:id/resolve', authenticate, resolveDisputeValidators, disputeController.resolveDispute);

module.exports = router;
