const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const { getDatabase } = require('../database');
const config = require('../config');

const TABLE_NAME = 'users';

function getUserById(userId) {
  const db = getDatabase();
  
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  const user = stmt.get(userId);
  
  if (user) {
    user.created_at = dayjs(user.created_at).format('YYYY-MM-DD HH:mm:ss');
    user.updated_at = dayjs(user.updated_at).format('YYYY-MM-DD HH:mm:ss');
  }
  
  return user;
}

function getUserByUsername(username) {
  const db = getDatabase();
  
  const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
  const user = stmt.get(username);
  
  if (user) {
    user.created_at = dayjs(user.created_at).format('YYYY-MM-DD HH:mm:ss');
    user.updated_at = dayjs(user.updated_at).format('YYYY-MM-DD HH:mm:ss');
  }
  
  return user;
}

function getUserList(filters = {}) {
  const db = getDatabase();
  let sql = 'SELECT * FROM users WHERE 1=1';
  const params = [];

  if (filters.role) {
    sql += ' AND role = ?';
    params.push(filters.role);
  }

  sql += ' ORDER BY created_at DESC';

  const stmt = db.prepare(sql);
  const users = stmt.all(...params);

  return users.map(user => ({
    ...user,
    created_at: dayjs(user.created_at).format('YYYY-MM-DD HH:mm:ss'),
    updated_at: dayjs(user.updated_at).format('YYYY-MM-DD HH:mm:ss'),
  }));
}

function createUser(data) {
  const db = getDatabase();
  
  const user = {
    id: uuidv4(),
    username: data.username,
    role: data.role,
    name: data.name,
    created_at: dayjs().valueOf(),
    updated_at: dayjs().valueOf(),
  };

  const stmt = db.prepare(`
    INSERT INTO users (id, username, role, name, created_at, updated_at)
    VALUES (@id, @username, @role, @name, @created_at, @updated_at)
  `);

  stmt.run(user);
  
  return user;
}

function hasPermission(role, permission) {
  const rolePermissions = {
    [config.roles.ADMIN]: ['*'],
    [config.roles.MANAGER]: [
      'order:view', 'order:create', 'order:update', 'order:submit',
      'message:view', 'message:create', 'message:update', 'message:submit',
      'maintenance:view', 'maintenance:create', 'maintenance:update', 'maintenance:submit',
      'workflow:confirm', 'workflow:reject',
      'batch:view', 'batch:create',
      'history:view',
      'export:view',
      'task:view', 'task:retry',
    ],
    [config.roles.SUPERVISOR]: [
      'order:view', 'order:create', 'order:update', 'order:submit',
      'message:view', 'message:create', 'message:update', 'message:submit',
      'maintenance:view', 'maintenance:create', 'maintenance:update', 'maintenance:submit',
      'workflow:confirm',
      'batch:view',
      'history:view',
      'task:view',
    ],
    [config.roles.STAFF]: [
      'order:view', 'order:create', 'order:submit',
      'message:view', 'message:create', 'message:submit',
      'maintenance:view', 'maintenance:create',
      'batch:view',
    ],
    [config.roles.AUDITOR]: [
      'order:view',
      'message:view',
      'maintenance:view',
      'workflow:audit',
      'batch:view',
      'history:view',
      'export:view', 'export:download',
    ],
  };

  const permissions = rolePermissions[role] || [];
  
  if (permissions.includes('*')) return true;
  return permissions.includes(permission);
}

function canViewSensitiveData(role) {
  return [config.roles.ADMIN, config.roles.MANAGER, config.roles.AUDITOR].includes(role);
}

module.exports = {
  getUserById,
  getUserByUsername,
  getUserList,
  createUser,
  hasPermission,
  canViewSensitiveData,
  TABLE_NAME,
};
