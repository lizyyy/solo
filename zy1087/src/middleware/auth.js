const { verifyToken } = require('../utils/jwt');
const { AuthenticationError, AuthorizationError } = require('../utils/errors');

const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('缺少认证令牌');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded) {
      throw new AuthenticationError('无效的认证令牌');
    }

    req.user = {
      id: decoded.userId,
      email: decoded.email,
      name: decoded.name
    };

    next();
  } catch (error) {
    next(error);
  }
};

const optionalAuthenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);

      if (decoded) {
        req.user = {
          id: decoded.userId,
          email: decoded.email,
          name: decoded.name
        };
      }
    }
    next();
  } catch (error) {
    next();
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new AuthenticationError('需要先登录');
    }

    if (roles.length > 0 && !roles.includes(req.user.role)) {
      throw new AuthorizationError('权限不足');
    }

    next();
  };
};

module.exports = {
  authenticate,
  optionalAuthenticate,
  requireRole
};
