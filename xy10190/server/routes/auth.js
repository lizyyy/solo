const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

const router = express.Router();

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
    }

    const user = await db.get(
      `SELECT id, username, password, name, role, email, department FROM users WHERE username = ?`,
      [username]
    );

    if (!user) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }

    req.session.userId = user.id;
    req.session.userRole = user.role;
    req.session.username = user.username;

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        email: user.email,
        department: user.department
      }
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: '登出失败' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true, message: '登出成功' });
  });
});

router.get('/me', (req, res) => {
  if (req.session.userId) {
    res.json({
      success: true,
      user: {
        id: req.session.userId,
        username: req.session.username,
        role: req.session.userRole
      }
    });
  } else {
    res.json({ success: false, message: '未登录' });
  }
});

router.get('/approvers', async (req, res, next) => {
  try {
    const approvers = await db.all(
      `SELECT id, name, role, department FROM users WHERE role IN ('manager', 'director') ORDER BY department`
    );
    res.json({ success: true, approvers });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
