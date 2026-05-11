const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: '用户名和密码不能为空'
      });
    }

    const result = await db.query(
      'SELECT id, username, password, full_name, email, role FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: '用户名或密码错误'
      });
    }

    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({
        error: '用户名或密码错误'
      });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        role: user.role
      },
      process.env.JWT_SECRET || 'your-secret-key',
      {
        expiresIn: '24h'
      }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: '服务器内部错误'
    });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { username, password, fullName, email } = req.body;

    if (!username || !password || !fullName) {
      return res.status(400).json({
        error: '用户名、密码和姓名不能为空'
      });
    }

    const existingUser = await db.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        error: '用户名已存在'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    const result = await db.query(
      `INSERT INTO users (id, username, password, full_name, email, role)
       VALUES ($1, $2, $3, $4, $5, 'operator')
       RETURNING id, username, full_name, email, role`,
      [userId, username, hashedPassword, fullName, email]
    );

    const token = jwt.sign(
      {
        userId: result.rows[0].id,
        username: result.rows[0].username,
        role: result.rows[0].role
      },
      process.env.JWT_SECRET || 'your-secret-key',
      {
        expiresIn: '24h'
      }
    );

    res.status(201).json({
      token,
      user: {
        id: result.rows[0].id,
        username: result.rows[0].username,
        fullName: result.rows[0].full_name,
        email: result.rows[0].email,
        role: result.rows[0].role
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      error: '服务器内部错误'
    });
  }
});

router.post('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        error: '未提供认证令牌'
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    const result = await db.query(
      'SELECT id, username, full_name, email, role FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: '用户不存在'
      });
    }

    const user = result.rows[0];
    res.json({
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: '无效的认证令牌'
      });
    }

    console.error('Me error:', error);
    res.status(500).json({
      error: '服务器内部错误'
    });
  }
});

module.exports = router;
