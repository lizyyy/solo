const express = require('express');
const { param, query } = require('express-validator');
const exportController = require('../controllers/exportController');
const { authenticate } = require('../middleware/auth');
const { validate, validateId } = require('../middleware/validate');

const router = express.Router();

const exportValidators = [
  param('id')
    .custom(validateId),
  query('format')
    .optional()
    .isIn(['json', 'markdown', 'md']).withMessage('导出格式必须是 json 或 markdown'),
  validate
];

router.get('/orders/:id', authenticate, exportValidators, exportController.exportOrder);

module.exports = router;
