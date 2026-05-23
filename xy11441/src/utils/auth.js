const { getDb } = require('./database');
const crypto = require('crypto');

let currentUser = null;

const ROLES = {
  entry: {
    name: '录入员',
    permissions: ['import', 'view', 'fix_own'],
    visibleFields: ['*']
  },
  review: {
    name: '复核员',
    permissions: ['import', 'view', 'review', 'fix'],
    visibleFields: ['*']
  },
  manager: {
    name: '主管',
    permissions: ['import', 'view', 'review', 'fix', 'report', 'export', 'user_manage'],
    visibleFields: ['*']
  },
  readonly: {
    name: '只读查看',
    permissions: ['view'],
    visibleFields: ['supplier_name', 'product_name', 'delivery_date', 'status']
  }
};

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function login(username, password) {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  
  if (!user) {
    throw new Error('用户不存在');
  }
  
  const passwordHash = hashPassword(password);
  if (user.password_hash !== passwordHash) {
    throw new Error('密码错误');
  }
  
  currentUser = user;
  return user;
}

function logout() {
  currentUser = null;
}

function getCurrentUser() {
  return currentUser;
}

function requirePermission(permission) {
  if (!currentUser) {
    throw new Error('请先登录');
  }
  
  const roleConfig = ROLES[currentUser.role];
  if (!roleConfig || !roleConfig.permissions.includes(permission)) {
    throw new Error(`权限不足，需要 ${permission} 权限`);
  }
  
  return true;
}

function filterFieldsByRole(data, role) {
  const roleConfig = ROLES[role];
  if (!roleConfig) return data;
  
  if (roleConfig.visibleFields.includes('*')) {
    return data;
  }
  
  const filtered = {};
  for (const field of roleConfig.visibleFields) {
    if (data[field] !== undefined) {
      filtered[field] = data[field];
    }
  }
  return filtered;
}

function createUser(username, password, role, createdBy) {
  if (!currentUser || !ROLES[currentUser.role].permissions.includes('user_manage')) {
    throw new Error('权限不足，无法创建用户');
  }
  
  if (!ROLES[role]) {
    throw new Error('无效的角色');
  }
  
  const db = getDb();
  const passwordHash = hashPassword(password);
  
  try {
    const result = db.prepare(`
      INSERT INTO users (username, password_hash, role)
      VALUES (?, ?, ?)
    `).run(username, passwordHash, role);
    
    logOperation('create_user', 'users', result.lastInsertRowid, null, JSON.stringify({ username, role }), createdBy);
    
    return result.lastInsertRowid;
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new Error('用户名已存在');
    }
    throw e;
  }
}

function logOperation(action, tableName, recordId, oldValue, newValue, userId = null) {
  const db = getDb();
  const uid = userId || (currentUser ? currentUser.id : null);
  
  db.prepare(`
    INSERT INTO operation_history (user_id, action, table_name, record_id, old_value, new_value)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(uid, action, tableName, recordId, oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null);
}

module.exports = {
  ROLES,
  login,
  logout,
  getCurrentUser,
  requirePermission,
  filterFieldsByRole,
  createUser,
  hashPassword,
  logOperation
};
