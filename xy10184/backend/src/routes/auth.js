const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database');
const { authMiddleware, generateToken } = require('../middleware/auth');
const { createLog, logActions, logModules } = require('../utils/logger');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }
  
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  
  if (!user) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  
  const isMatch = bcrypt.compareSync(password, user.password);
  
  if (!isMatch) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  
  const token = generateToken(user);
  
  createLog(req, logActions.LOGIN, logModules.AUTH, `用户 ${user.name} 登录成功`, user.id);
  
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role
    }
  });
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

router.get('/users', authMiddleware, (req, res) => {
  const users = db.prepare(`
    SELECT id, username, name, role, created_at 
    FROM users 
    ORDER BY id
  `).all();
  
  res.json({ users });
});

module.exports = router;
