const jwt = require('jsonwebtoken');
const db = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'reconciliation-secret-key-2024';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: '无效的认证令牌' });
    }
    req.user = user;
    next();
  });
}

function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: '权限不足' });
    }
    next();
  };
}

async function login(username, password) {
  const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
  
  if (!user) {
    throw new Error('用户不存在');
  }

  const bcrypt = require('bcryptjs');
  const valid = await bcrypt.compare(password, user.password_hash);
  
  if (!valid) {
    throw new Error('密码错误');
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, realName: user.real_name, storeId: user.store_id },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      realName: user.real_name,
      role: user.role,
      storeId: user.store_id
    }
  };
}

module.exports = {
  authenticateToken,
  requireRole,
  login,
  JWT_SECRET
};
