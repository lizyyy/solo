const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { get } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';

const ROLES = {
  ENTRY: 'entry',
  REVIEWER: 'reviewer',
  MANAGER: 'manager',
  READONLY: 'readonly'
};

const ROLE_PERMISSIONS = {
  [ROLES.ENTRY]: {
    visibleFields: ['batch_no', 'vin', 'plate_number', 'car_model', 'status', 'total_amount', 'created_at'],
    actions: ['create_batch', 'edit_batch', 'submit_batch', 'upload_attachment', 'view_history', 'view_dirty_records']
  },
  [ROLES.REVIEWER]: {
    visibleFields: ['*'],
    actions: ['view_batch', 'review_approve', 'review_reject', 'edit_batch', 'view_history', 'view_dirty_records', 'resolve_dirty_record']
  },
  [ROLES.MANAGER]: {
    visibleFields: ['*'],
    actions: ['*']
  },
  [ROLES.READONLY]: {
    visibleFields: ['batch_no', 'vin', 'plate_number', 'car_model', 'status', 'total_amount', 
                   'freeze_reason', 'freeze_time', 'frozen_status', 'manual_reason',
                   'entry_user_name', 'created_at', 'updated_at'],
    actions: ['view_batch', 'view_history', 'export_summary']
  }
};

async function login(username, password) {
  const user = await get('SELECT * FROM users WHERE username = ?', [username]);
  if (!user) {
    throw new Error('用户不存在');
  }
  
  const isValid = bcrypt.compareSync(password, user.password_hash);
  if (!isValid) {
    throw new Error('密码错误');
  }
  
  const token = jwt.sign(
    {
      userId: user.id,
      username: user.username,
      role: user.role,
      realName: user.real_name
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
  
  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      realName: user.real_name
    }
  };
}

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: '认证令牌无效或已过期' });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: '权限不足，需要以下角色之一: ' + allowedRoles.join(', ') });
    }
    
    next();
  };
}

function requirePermission(action) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }
    
    const permissions = ROLE_PERMISSIONS[req.user.role];
    if (!permissions) {
      return res.status(403).json({ error: '角色权限未定义' });
    }
    
    if (permissions.actions[0] === '*' || permissions.actions.includes(action)) {
      next();
    } else {
      return res.status(403).json({ error: `没有执行 ${action} 的权限` });
    }
  };
}

function filterFieldsByRole(data, role) {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions || permissions.visibleFields[0] === '*') {
    return data;
  }
  
  if (Array.isArray(data)) {
    return data.map(item => filterObjectFields(item, permissions.visibleFields));
  }
  
  return filterObjectFields(data, permissions.visibleFields);
}

function filterObjectFields(obj, visibleFields) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  
  const filtered = {};
  for (const field of visibleFields) {
    if (field in obj) {
      filtered[field] = obj[field];
    }
  }
  return filtered;
}

function canPerformAction(role, action) {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.actions[0] === '*' || permissions.actions.includes(action);
}

module.exports = {
  ROLES,
  ROLE_PERMISSIONS,
  login,
  authenticate,
  requireRole,
  requirePermission,
  filterFieldsByRole,
  canPerformAction
};
