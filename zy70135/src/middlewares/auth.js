const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../models');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');

const authMiddleware = {
  async authenticate(req, res, next) {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedError('未提供认证令牌');
      }

      const token = authHeader.substring(7);

      let decoded;
      try {
        decoded = jwt.verify(token, config.jwt.secret);
      } catch (error) {
        if (error.name === 'TokenExpiredError') {
          throw new UnauthorizedError('认证令牌已过期');
        }
        throw new UnauthorizedError('无效的认证令牌');
      }

      const user = await db.User.findByPk(decoded.userId);

      if (!user) {
        throw new UnauthorizedError('用户不存在或已被禁用');
      }

      if (!user.isActive) {
        throw new UnauthorizedError('用户已被禁用');
      }

      req.user = user;
      req.requestContext = {
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        businessLineId: user.businessLineId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        requestId: req.id || generateRequestId(),
        timestamp: new Date(),
      };

      next();
    } catch (error) {
      next(error);
    }
  },

  requirePermission(permission) {
    return (req, res, next) => {
      try {
        if (!req.user) {
          throw new UnauthorizedError('未认证');
        }

        const permissions = req.user.getPermissions();
        if (!permissions.includes(permission)) {
          throw new ForbiddenError(`没有权限: ${permission}`);
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  },

  requireRole(...roles) {
    return (req, res, next) => {
      try {
        if (!req.user) {
          throw new UnauthorizedError('未认证');
        }

        if (!roles.includes(req.user.role)) {
          throw new ForbiddenError(`需要角色: ${roles.join(', ')}`);
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  },

  optionalAuthenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authMiddleware.authenticate(req, res, next);
    }
    next();
  },
};

function generateRequestId() {
  return `req-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

module.exports = authMiddleware;
