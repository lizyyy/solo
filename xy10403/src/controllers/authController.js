const db = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config');

const login = (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ code: 400, message: '用户名和密码不能为空' });
  }

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
    }

    if (!user) {
      return res.status(401).json({ code: 401, message: '用户名或密码错误' });
    }

    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) {
        return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
      }

      if (!isMatch) {
        return res.status(401).json({ code: 401, message: '用户名或密码错误' });
      }

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role, name: user.name },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      res.json({
        code: 200,
        message: '登录成功',
        data: {
          token,
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
            name: user.name
          }
        }
      });
    });
  });
};

const getCurrentUser = (req, res) => {
  res.json({
    code: 200,
    message: '获取成功',
    data: req.user
  });
};

module.exports = {
  login,
  getCurrentUser
};
