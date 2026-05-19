const { User, Role } = require('../models');
const logger = require('../config/logger');

const authMiddleware = async (req, res, next) => {
  const userId = req.headers['x-user-id'] || req.query.userId;
  
  if (!userId) {
    return res.status(401).json({
      success: false,
      message: '未提供用户ID，请在请求头中添加 x-user-id'
    });
  }

  try {
    const user = await User.findByPk(userId, {
      include: [{ model: Role, as: 'role' }]
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户不存在'
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: '用户已被禁用'
      });
    }

    req.user = user;
    req.operatorId = user.id;
    req.ipAddress = req.ip || req.connection.remoteAddress;
    req.userAgent = req.headers['user-agent'];

    logger.info('用户认证成功', {
      userId: user.id,
      username: user.username,
      role: user.role.name
    });

    next();
  } catch (error) {
    logger.error('用户认证失败', { error: error.message, userId });
    return res.status(500).json({
      success: false,
      message: '认证失败',
      error: error.message
    });
  }
};

const permissionMiddleware = (requiredPermission) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({
        success: false,
        message: '无权限访问'
      });
    }

    const permissions = req.user.role.permissions || [];
    
    if (!permissions.includes(requiredPermission)) {
      logger.warn('权限不足', {
        userId: req.user.id,
        requiredPermission,
        userPermissions: permissions
      });
      
      return res.status(403).json({
        success: false,
        message: '权限不足'
      });
    }

    next();
  };
};

module.exports = {
  authMiddleware,
  permissionMiddleware
};
