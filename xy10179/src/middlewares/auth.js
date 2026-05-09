const jwt = require('jsonwebtoken');
const { secret } = require('../config/jwt');
const { User, SecurityIncident, AuditLog, Tenant } = require('../models');

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: '缺少认证令牌'
    });
  }

  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, secret);
    const user = await User.findByPk(decoded.userId);
    
    if (!user || user.status !== 'active') {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: '用户不存在或已禁用'
      });
    }
    
    req.user = user;
    req.tenantId = user.currentTenantId;
    next();
  } catch (error) {
    let errorType = 'UNAUTHORIZED';
    let message = '认证失败';
    let severity = 'medium';
    let userId = null;
    
    if (error.name === 'TokenExpiredError') {
      errorType = 'TOKEN_EXPIRED';
      message = '令牌已过期';
      severity = 'low';
      
      try {
        const decoded = jwt.verify(token, secret, { ignoreExpiration: true });
        userId = decoded.userId;
      } catch (e) {
        // ignore
      }
    } else if (error.name === 'JsonWebTokenError') {
      errorType = 'UNAUTHORIZED_ACCESS';
      message = '无效的认证令牌';
      severity = 'high';
    }
    
    const requestId = req.headers['x-request-id'] || req.id;
    
    const defaultTenant = await Tenant.findOne({ where: { code: 'TENANT_A' } });
    const fallbackTenantId = defaultTenant ? defaultTenant.id : '00000000-0000-0000-0000-000000000000';
    
    try {
      await SecurityIncident.create({
        tenantId: fallbackTenantId,
        userId,
        type: errorType,
        severity,
        description: message,
        details: JSON.stringify({ error: error.message }),
        ipAddress: req.ip,
        requestId
      });

      await AuditLog.create({
        tenantId: fallbackTenantId,
        userId,
        action: 'UNAUTHORIZED_ACCESS',
        resourceType: 'AUTH',
        status: 'failure',
        errorMessage: `${errorType}: ${message}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        requestId
      });
    } catch (logError) {
      console.error('记录安全事件失败:', logError.message);
    }

    return res.status(401).json({
      success: false,
      error: errorType,
      message
    });
  }
};

const roleMiddleware = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: '未认证'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: '权限不足'
      });
    }

    next();
  };
};

module.exports = {
  authMiddleware,
  roleMiddleware
};
