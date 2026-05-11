const jwt = require('jsonwebtoken');
const db = require('./db');

const SECRET_KEY = 'library-management-secret-key-change-this';

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, max_secret_level: user.max_secret_level },
    SECRET_KEY,
    { expiresIn: '24h' }
  );
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      return res.status(403).json({ error: '令牌无效或已过期' });
    }
    req.user = user;
    next();
  });
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: '权限不足，需要以下角色之一: ' + roles.join(', ') });
    }
    next();
  };
}

function canAccessSecretLevel(requiredLevel) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }
    if (req.user.max_secret_level < requiredLevel) {
      return res.status(403).json({ 
        error: '权限不足，无法访问该密级资料',
        user_level: req.user.max_secret_level,
        required_level: requiredLevel
      });
    }
    next();
  };
}

function checkNoOverdue(req, res, next) {
  const userId = req.user.id;
  const overdue = db.prepare(`
    SELECT id FROM borrow_records 
    WHERE user_id = ? AND status = 'overdue'
    LIMIT 1
  `).get(userId);
  
  if (overdue) {
    return res.status(403).json({ error: '存在逾期未处理的借阅记录，无法进行新的借阅操作' });
  }
  next();
}

module.exports = {
  generateToken,
  authenticateToken,
  requireRole,
  canAccessSecretLevel,
  checkNoOverdue,
  SECRET_KEY
};
