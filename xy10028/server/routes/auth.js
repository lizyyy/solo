const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../models');

const router = express.Router();

router.post('/register', async (req, res, next) => {
  try {
    const { username, password, name, role = 'operator', storeId } = req.body;

    if (!username || !password || !name) {
      return res.status(400).json({ success: false, message: '用户名、密码和姓名不能为空' });
    }

    const existingUser = await db.User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: '用户名已存在' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await db.User.create({
      id: uuidv4(),
      username,
      password: hashedPassword,
      name,
      role,
      storeId
    });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, storeId: user.storeId },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          storeId: user.storeId
        }
      },
      message: '注册成功'
    });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
    }

    const user = await db.User.findOne({ where: { username } });
    if (!user) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: '账户已被禁用' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, storeId: user.storeId },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          storeId: user.storeId
        }
      },
      message: '登录成功'
    });
  } catch (error) {
    next(error);
  }
});

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: '未授权访问' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'token无效或已过期' });
  }
};

const roleMiddleware = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: '权限不足' });
    }
    next();
  };
};

module.exports = router;
module.exports.authMiddleware = authMiddleware;
module.exports.roleMiddleware = roleMiddleware;
