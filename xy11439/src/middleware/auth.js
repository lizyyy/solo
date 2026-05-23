const { getUserById } = require('../models/user');

function authMiddleware(req, res, next) {
  const userId = req.headers['x-user-id'];
  const username = req.headers['x-username'];

  if (!userId && !username) {
    return res.status(401).json({ error: '未提供用户认证信息' });
  }

  let user;
  if (userId) {
    user = getUserById(userId);
  }

  if (!user && username) {
    const { getUserByUsername } = require('../models/user');
    user = getUserByUsername(username);
  }

  if (!user) {
    return res.status(401).json({ error: '用户不存在' });
  }

  req.user = user;
  next();
}

function requirePermission(permission) {
  return (req, res, next) => {
    const { hasPermission } = require('../models/user');
    
    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({ error: '权限不足' });
    }
    next();
  };
}

module.exports = {
  authMiddleware,
  requirePermission,
};
