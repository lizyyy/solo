const jwt = require('jsonwebtoken');
const config = require('../config/config');
const pool = require('../database/pool');
const { ApiError } = require('../utils/response');

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError('未提供认证令牌', 401, 'AUTH_TOKEN_MISSING');
    }

    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, config.app.jwtSecret);
      
      const result = await pool.query(
        'SELECT id, username, real_name, department, role, is_active FROM operators WHERE id = $1',
        [decoded.operatorId]
      );

      if (result.rows.length === 0 || !result.rows[0].is_active) {
        throw new ApiError('用户不存在或已被禁用', 401, 'AUTH_USER_INVALID');
      }

      req.operator = result.rows[0];
      next();
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        throw new ApiError('令牌已过期', 401, 'AUTH_TOKEN_EXPIRED');
      }
      throw new ApiError('无效的认证令牌', 401, 'AUTH_TOKEN_INVALID');
    }
  } catch (error) {
    next(error);
  }
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.operator) {
      throw new ApiError('未授权访问', 401, 'AUTH_REQUIRED');
    }

    if (!roles.includes(req.operator.role)) {
      throw new ApiError(`需要 ${roles.join(', ')} 权限`, 403, 'AUTH_PERMISSION_DENIED');
    }

    next();
  };
}

module.exports = { authenticate, requireRoles };
