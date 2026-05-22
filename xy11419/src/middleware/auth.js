const { ROLES, ROLE_PERMISSIONS } = require('../utils/constants');

function getCurrentUser(req) {
  const userId = req.headers['x-user-id'] || 'default_user';
  const userName = req.headers['x-user-name'] || '系统用户';
  const userRole = req.headers['x-user-role'] || ROLES.ADMIN;
  
  return {
    id: userId,
    name: userName,
    role: userRole
  };
}

function hasPermission(user, permission) {
  if (!user) return false;
  
  const userPermissions = ROLE_PERMISSIONS[user.role] || [];
  if (userPermissions.includes('*')) return true;
  
  if (userPermissions.includes(permission)) return true;
  
  const basePermission = permission.split(':')[0];
  return userPermissions.includes(`${basePermission}:*`);
}

function requirePermission(permission) {
  return (req, res, next) => {
    const user = getCurrentUser(req);
    req.user = user;
    
    if (!hasPermission(user, permission)) {
      return res.status(403).json({
        error: '权限不足',
        required_permission: permission,
        user_role: user.role
      });
    }
    
    next();
  };
}

function requireRole(allowedRoles) {
  return (req, res, next) => {
    const user = getCurrentUser(req);
    req.user = user;
    
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({
        error: '角色不允许',
        allowed_roles: allowedRoles,
        user_role: user.role
      });
    }
    
    next();
  };
}

function authMiddleware(req, res, next) {
  req.user = getCurrentUser(req);
  next();
}

module.exports = {
  getCurrentUser,
  hasPermission,
  requirePermission,
  requireRole,
  authMiddleware
};
