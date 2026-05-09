const db = require('../database/connection');
const { v4: uuidv4 } = require('uuid');
const { NotFoundError, ValidationError } = require('../middleware/response');

async function getUsers(activeOnly = true) {
  let sql = 'SELECT * FROM users';
  const params = [];
  
  if (activeOnly) {
    sql += ' WHERE is_active = 1';
  }
  sql += ' ORDER BY display_name';
  
  return db.all(sql, params);
}

async function getUserById(userId) {
  const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) {
    throw new NotFoundError('用户不存在');
  }
  return user;
}

async function getUserByUsername(username) {
  const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
  return user;
}

async function createUser(data) {
  if (!data.username || !data.display_name) {
    throw new ValidationError('用户名和显示名称不能为空');
  }
  
  const existing = await getUserByUsername(data.username);
  if (existing) {
    throw new ValidationError('用户名已存在');
  }
  
  const now = Date.now();
  const id = uuidv4();
  
  await db.run(
    `INSERT INTO users (id, username, display_name, role, is_active, created_at)
     VALUES (?, ?, ?, ?, 1, ?)`,
    [id, data.username, data.display_name, data.role || 'operator', now]
  );
  
  return getUserById(id);
}

async function updateUser(userId, data) {
  const user = await getUserById(userId);
  
  const updates = [];
  const params = [];
  
  if (data.display_name !== undefined) {
    updates.push('display_name = ?');
    params.push(data.display_name);
  }
  if (data.role !== undefined) {
    updates.push('role = ?');
    params.push(data.role);
  }
  if (data.is_active !== undefined) {
    updates.push('is_active = ?');
    params.push(data.is_active ? 1 : 0);
  }
  
  if (updates.length === 0) {
    return user;
  }
  
  params.push(userId);
  
  await db.run(
    `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
    params
  );
  
  return getUserById(userId);
}

async function deleteUser(userId) {
  await getUserById(userId);
  await db.run('DELETE FROM users WHERE id = ?', [userId]);
  return { id: userId, deleted: true };
}

module.exports = {
  getUsers,
  getUserById,
  getUserByUsername,
  createUser,
  updateUser,
  deleteUser
};
