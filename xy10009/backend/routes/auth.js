const express = require('express');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '用户名和密码不能为空'
      });
    }

    const user = await User.findOne({ where: { username } });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    const isValid = await user.comparePassword(password);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          role: user.role
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/register', async (req, res, next) => {
  try {
    const { username, password, fullName } = req.body;

    if (!username || !password || !fullName) {
      return res.status(400).json({
        success: false,
        message: '用户名、密码和姓名不能为空'
      });
    }

    const existingUser = await User.findOne({ where: { username } });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: '用户名已存在'
      });
    }

    const user = await User.create({
      username,
      password,
      fullName,
      role: 'user'
    });

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          role: user.role
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/me', requireLogin, (req, res) => {
  res.json({
    success: true,
    data: req.user
  });
});

module.exports = router;