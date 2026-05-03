const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validate, validateEmail, validatePassword, validatePhone } = require('../middleware/validate');

const router = express.Router();

const registerValidators = [
  body('name')
    .notEmpty().withMessage('姓名不能为空')
    .isLength({ min: 2, max: 50 }).withMessage('姓名长度应在2-50个字符之间'),
  body('email')
    .notEmpty().withMessage('邮箱不能为空')
    .custom(validateEmail),
  body('password')
    .notEmpty().withMessage('密码不能为空')
    .custom(validatePassword),
  body('phone')
    .optional()
    .custom(validatePhone),
  validate
];

const loginValidators = [
  body('email')
    .notEmpty().withMessage('邮箱不能为空')
    .custom(validateEmail),
  body('password')
    .notEmpty().withMessage('密码不能为空'),
  validate
];

const updateUserValidators = [
  body('name')
    .optional()
    .isLength({ min: 2, max: 50 }).withMessage('姓名长度应在2-50个字符之间'),
  body('phone')
    .optional()
    .custom(validatePhone),
  body('avatar_url')
    .optional()
    .isURL().withMessage('头像URL格式无效'),
  validate
];

const changePasswordValidators = [
  body('current_password')
    .notEmpty().withMessage('当前密码不能为空'),
  body('new_password')
    .notEmpty().withMessage('新密码不能为空')
    .custom(validatePassword),
  validate
];

router.post('/register', registerValidators, authController.register);
router.post('/login', loginValidators, authController.login);
router.get('/me', authenticate, authController.getCurrentUser);
router.put('/me', authenticate, updateUserValidators, authController.updateCurrentUser);
router.post('/change-password', authenticate, changePasswordValidators, authController.changePassword);

module.exports = router;
