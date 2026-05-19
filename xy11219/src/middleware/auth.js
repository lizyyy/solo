const { db } = require('../database/init');

const ROLES = {
  ADMIN: 'admin',
  STORE_MANAGER: 'store_manager',
  QC_STAFF: 'qc_staff',
  KITCHEN_STAFF: 'kitchen_staff'
};

const PERMISSIONS = {
  SAMPLE_CREATE: 'sample:create',
  SAMPLE_READ: 'sample:read',
  SAMPLE_REVIEW: 'sample:review',
  TEMPERATURE_CREATE: 'temperature:create',
  TEMPERATURE_READ: 'temperature:read',
  WASTE_CREATE: 'waste:create',
  WASTE_READ: 'waste:read',
  WASTE_REVIEW: 'waste:review',
  AUDIT_READ: 'audit:read',
  EXPORT: 'export',
  USER_MANAGE: 'user:manage'
};

const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: Object.values(PERMISSIONS),
  [ROLES.STORE_MANAGER]: [
    PERMISSIONS.SAMPLE_READ,
    PERMISSIONS.SAMPLE_REVIEW,
    PERMISSIONS.TEMPERATURE_READ,
    PERMISSIONS.WASTE_READ,
    PERMISSIONS.WASTE_REVIEW,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.EXPORT
  ],
  [ROLES.QC_STAFF]: [
    PERMISSIONS.SAMPLE_CREATE,
    PERMISSIONS.SAMPLE_READ,
    PERMISSIONS.TEMPERATURE_CREATE,
    PERMISSIONS.TEMPERATURE_READ,
    PERMISSIONS.WASTE_CREATE,
    PERMISSIONS.WASTE_READ
  ],
  [ROLES.KITCHEN_STAFF]: [
    PERMISSIONS.SAMPLE_CREATE,
    PERMISSIONS.SAMPLE_READ,
    PERMISSIONS.TEMPERATURE_CREATE,
    PERMISSIONS.TEMPERATURE_READ
  ]
};

function getUserRole(userId) {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT u.*, r.name as role_name, r.permissions 
      FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.id = ?
    `, [userId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function requirePermission(permission) {
  return async (req, res, next) => {
    try {
      const userId = req.headers['x-user-id'];
      
      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          message: '缺少用户标识' 
        });
      }

      const user = await getUserRole(userId);
      
      if (!user) {
        return res.status(401).json({ 
          success: false, 
          message: '用户不存在' 
        });
      }

      const permissions = JSON.parse(user.permissions);
      if (!permissions.includes(permission)) {
        return res.status(403).json({ 
          success: false, 
          message: '权限不足',
          required: permission
        });
      }

      req.user = {
        id: user.id,
        username: user.username,
        realName: user.real_name,
        role: user.role_name
      };
      
      next();
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: '权限校验失败',
        error: error.message 
      });
    }
  };
}

function maskSensitiveFields(data, userRole) {
  if (!data) return data;

  const isArray = Array.isArray(data);
  const items = isArray ? data : [data];

  const maskedItems = items.map(item => {
    const result = { ...item };
    
    if (userRole !== ROLES.ADMIN && userRole !== ROLES.STORE_MANAGER) {
      if (result.phone) {
        result.phone = maskPhone(result.phone);
      }
      if (result.operator_phone) {
        result.operator_phone = maskPhone(result.operator_phone);
      }
      if (result.reviewer_phone) {
        result.reviewer_phone = maskPhone(result.reviewer_phone);
      }
    }

    return result;
  });

  return isArray ? maskedItems : maskedItems[0];
}

function maskPhone(phone) {
  if (!phone || phone.length < 7) return '***';
  return phone.substring(0, 3) + '****' + phone.substring(phone.length - 4);
}

function maskLogData(data) {
  if (!data) return data;
  
  const masked = { ...data };
  const sensitiveFields = ['phone', 'mobile', 'telephone', 'email'];
  
  sensitiveFields.forEach(field => {
    if (masked[field]) {
      masked[field] = '***';
    }
  });
  
  return masked;
}

module.exports = {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  requirePermission,
  getUserRole,
  maskSensitiveFields,
  maskPhone,
  maskLogData
};
