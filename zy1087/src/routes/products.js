const express = require('express');
const { body, param, query } = require('express-validator');
const productController = require('../controllers/productController');
const { authenticate } = require('../middleware/auth');
const { validate, validateId, validateSerialSuffix, validateDepositRatio } = require('../middleware/validate');

const router = express.Router();

const { PRODUCT_CATEGORIES, PRODUCT_CONDITIONS, PRODUCT_STATUSES } = productController;

const createProductValidators = [
  body('title')
    .notEmpty().withMessage('商品标题不能为空')
    .isLength({ min: 5, max: 200 }).withMessage('商品标题长度应在5-200个字符之间'),
  body('description')
    .optional()
    .isLength({ max: 2000 }).withMessage('商品描述不能超过2000个字符'),
  body('category')
    .optional()
    .isIn(PRODUCT_CATEGORIES).withMessage(`商品分类必须是: ${PRODUCT_CATEGORIES.join(', ')}`),
  body('brand')
    .optional()
    .isLength({ max: 50 }).withMessage('品牌名称不能超过50个字符'),
  body('model')
    .optional()
    .isLength({ max: 100 }).withMessage('型号不能超过100个字符'),
  body('serial_number_suffix')
    .optional()
    .custom(validateSerialSuffix),
  body('condition')
    .optional()
    .isIn(PRODUCT_CONDITIONS).withMessage(`商品成色必须是: ${PRODUCT_CONDITIONS.join(', ')}`),
  body('accessories')
    .optional()
    .isArray().withMessage('配件必须是数组'),
  body('specs')
    .optional()
    .isObject().withMessage('规格必须是对象'),
  body('price')
    .notEmpty().withMessage('价格不能为空')
    .isFloat({ min: 0.01 }).withMessage('价格必须大于0'),
  body('deposit_ratio')
    .optional()
    .custom(validateDepositRatio),
  validate
];

const updateProductValidators = [
  param('id')
    .custom(validateId),
  body('title')
    .optional()
    .isLength({ min: 5, max: 200 }).withMessage('商品标题长度应在5-200个字符之间'),
  body('description')
    .optional()
    .isLength({ max: 2000 }).withMessage('商品描述不能超过2000个字符'),
  body('category')
    .optional()
    .isIn(PRODUCT_CATEGORIES).withMessage(`商品分类必须是: ${PRODUCT_CATEGORIES.join(', ')}`),
  body('condition')
    .optional()
    .isIn(PRODUCT_CONDITIONS).withMessage(`商品成色必须是: ${PRODUCT_CONDITIONS.join(', ')}`),
  body('price')
    .optional()
    .isFloat({ min: 0.01 }).withMessage('价格必须大于0'),
  validate
];

const getProductValidators = [
  param('id')
    .custom(validateId),
  validate
];

const listProductsValidators = [
  query('category')
    .optional()
    .isIn(PRODUCT_CATEGORIES).withMessage(`商品分类必须是: ${PRODUCT_CATEGORIES.join(', ')}`),
  query('condition')
    .optional()
    .isIn(PRODUCT_CONDITIONS).withMessage(`商品成色必须是: ${PRODUCT_CONDITIONS.join(', ')}`),
  query('status')
    .optional()
    .isIn(PRODUCT_STATUSES).withMessage(`商品状态必须是: ${PRODUCT_STATUSES.join(', ')}`),
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('页码必须是大于0的整数'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('每页数量必须是1-100之间的整数'),
  validate
];

router.get('/', listProductsValidators, productController.getProducts);
router.get('/me', authenticate, productController.getMyProducts);
router.get('/:id', getProductValidators, productController.getProductById);
router.post('/', authenticate, createProductValidators, productController.createProduct);
router.put('/:id', authenticate, updateProductValidators, productController.updateProduct);
router.delete('/:id', authenticate, getProductValidators, productController.deleteProduct);

module.exports = router;
