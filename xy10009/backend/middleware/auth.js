const jwt = require('jsonwebtoken');
const { User } = require('../models');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;

    if (!token) {
      return res.status(401).json({ message: '未登录或登录已过期' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.userId, {
      attributes: ['id', 'username', 'fullName', 'role']
    });

    if (!user) {
      return res.status(401).json({ message: '用户不存在' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: '登录已过期' });
    }
    return res.status(403).json({ message: '无效的访问令牌' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ message: '需要管理员权限' });
};

const requireLogin = authenticateToken;

module.exports = {
  authenticateToken,
  requireAdmin,
  requireLogin
};