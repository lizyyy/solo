const express = require('express');
const { body, validationResult } = require('express-validator');
const AuthService = require('../services/auth-service');
const { authMiddleware } = require('../middlewares/auth');
const { validate } = require('../middlewares/validators');
const ResponseUtils = require('../utils/response');

const router = express.Router();

router.post(
  '/login',
  [
    body('username').notEmpty().withMessage('用户名不能为空'),
    body('password').notEmpty().withMessage('密码不能为空'),
    validate,
  ],
  async (req, res, next) => {
    try {
      const result = await AuthService.login(req.body.username, req.body.password, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-request-id'],
      });

      ResponseUtils.success(res, result, '登录成功');
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/change-password',
  [
    authMiddleware(),
    body('oldPassword').notEmpty().withMessage('原密码不能为空'),
    body('newPassword').isLength({ min: 6 }).withMessage('新密码长度不能少于6位'),
    validate,
  ],
  async (req, res, next) => {
    try {
      await AuthService.changePassword(
        req.user.userId,
        req.body.oldPassword,
        req.body.newPassword
      );

      ResponseUtils.success(res, null, '密码修改成功');
    } catch (error) {
      next(error);
    }
  }
);

router.get('/me', authMiddleware(), async (req, res, next) => {
  try {
    const user = await AuthService.getCurrentUser(req.user.userId);
    ResponseUtils.success(res, user);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
