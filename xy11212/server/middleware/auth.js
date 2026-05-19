const { maskSensitiveData } = require('../config/logger');

const ROLES = {
  admin: ['*'],
  engineer: ['inspections:read', 'inspections:create', 'inspections:review', 'alarms:read', 'alarms:handle', 'workOrders:*'],
  operator: ['inspections:read', 'inspections:create', 'alarms:read', 'workOrders:read', 'workOrders:create']
};

const checkPermission = (userRole, permission) => {
  if (!userRole || !ROLES[userRole]) return false;
  const userPermissions = ROLES[userRole];
  if (userPermissions.includes('*')) return true;
  if (userPermissions.includes(permission)) return true;
  
  const [resource, action] = permission.split(':');
  return userPermissions.includes(`${resource}:*`);
};

const requirePermission = (permission) => {
  return (req, res, next) => {
    const userRole = req.user?.role;
    if (!checkPermission(userRole, permission)) {
      return res.status(403).json({ error: '权限不足' });
    }
    next();
  };
};

const maskResponseData = (req, res, next) => {
  const originalJson = res.json;
  res.json = function(data) {
    const masked = maskSensitiveData(data);
    return originalJson.call(this, masked);
  };
  next();
};

module.exports = { requirePermission, checkPermission, maskResponseData };
