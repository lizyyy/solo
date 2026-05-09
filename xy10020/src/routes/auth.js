const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const OperationLog = require('../models/OperationLog');
const { validate, schemas } = require('../middleware/validate');

const router = express.Router();

router.post('/login', validate(schemas.login), async (req, res, next) => {
  try {
    const { username, password } = req.body;

    const user = User.verifyPassword(username, password);

    if (!user) {
      return res.status(401).json({
        error: '认证失败',
        message: '用户名或密码错误'
      });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      config.jwt.secret,
      { expiresIn: '24h' }
    );

    OperationLog.create({
      operationType: 'LOGIN',
      entityType: 'user',
      entityId: user.id,
      userId: user.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      },
      expiresIn: 86400
    });
  } catch (error) {
    next(error);
  }
});

router.post('/register', validate(schemas.login), async (req, res, next) => {
  try {
    const { username, password } = req.body;

    const existingUser = User.findByUsername(username);
    if (existingUser) {
      return res.status(409).json({
        error: '注册失败',
        message: '用户名已存在'
      });
    }

    const user = User.create({
      username,
      password
    });

    OperationLog.create({
      operationType: 'REGISTER',
      entityType: 'user',
      entityId: user.id,
      userId: user.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      config.jwt.secret,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      },
      expiresIn: 86400
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
