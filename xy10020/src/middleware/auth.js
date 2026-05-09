const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: '未授权',
      message: '缺少认证令牌'
    });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    const user = User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        error: '未授权',
        message: '用户不存在'
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      error: '未授权',
      message: '无效的认证令牌'
    });
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: '未授权',
        message: '需要先登录'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: '禁止访问',
        message: '权限不足'
      });
    }

    next();
  };
};

const authenticateWebSocket = (info, callback) => {
  const urlParams = new URLSearchParams(info.req.url.split('?')[1]);
  const token = urlParams.get('token');

  if (!token) {
    return callback(false, 401, '缺少认证令牌');
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    const user = User.findById(decoded.userId);

    if (!user) {
      return callback(false, 401, '用户不存在');
    }

    info.req.user = user;
    callback(true);
  } catch (err) {
    callback(false, 401, '无效的认证令牌');
  }
};

module.exports = {
  authenticate,
  requireRole,
  authenticateWebSocket
};
