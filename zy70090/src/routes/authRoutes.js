const express = require('express');
const { ApiResponse } = require('../utils/response');
const AuthService = require('../services/authService');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json(ApiResponse.error('请提供用户名和密码', 400));
    }

    const result = await AuthService.login(username, password);
    res.json(ApiResponse.success(result, '登录成功'));
  } catch (error) {
    next(error);
  }
});

router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { old_password, new_password } = req.body;
    
    if (!old_password || !new_password) {
      return res.status(400).json(ApiResponse.error('请提供原密码和新密码', 400));
    }

    if (new_password.length < 6) {
      return res.status(400).json(ApiResponse.error('新密码长度不能少于6位', 400));
    }

    const result = await AuthService.changePassword(req.operator.id, old_password, new_password);
    res.json(ApiResponse.success(result));
  } catch (error) {
    next(error);
  }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await AuthService.getCurrentUser(req.operator.id);
    res.json(ApiResponse.success(user));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
