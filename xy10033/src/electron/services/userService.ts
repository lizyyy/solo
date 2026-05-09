import { v4 as uuidv4 } from 'uuid';
import { User, UserRole, OperationType } from '../../shared/types';
import { getDatabase } from '../database';
import { createAuditLog } from './auditService';

export function createUser(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>, operator: User): User {
  const db = getDatabase();
  const now = new Date().toISOString();
  const id = uuidv4();
  
  try {
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(data.username);
    if (existingUser) {
      throw new Error('用户名已存在');
    }
    
    const stmt = db.prepare(`
      INSERT INTO users (id, username, password, name, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, data.username, data.password, data.name, data.role, now, now);
    
    const user = getUserById(id)!;
    
    createAuditLog({
      operationType: OperationType.CREATE,
      targetType: 'user',
      targetId: id,
      userId: operator.id,
      userName: operator.name,
      detail: `创建用户: ${data.name} (${data.username})`,
      success: true
    });
    
    return user;
  } catch (error: any) {
    createAuditLog({
      operationType: OperationType.CREATE,
      targetType: 'user',
      targetId: null,
      userId: operator.id,
      userName: operator.name,
      detail: `创建用户失败: ${data.username}`,
      success: false,
      errorMessage: error.message
    });
    throw error;
  }
}

export function updateUser(id: string, data: Partial<User>, operator: User): User {
  const db = getDatabase();
  const now = new Date().toISOString();
  const existingUser = getUserById(id);
  
  if (!existingUser) {
    throw new Error('用户不存在');
  }
  
  const updates: string[] = [];
  const values: any[] = [];
  
  if (data.name) {
    updates.push('name = ?');
    values.push(data.name);
  }
  if (data.password) {
    updates.push('password = ?');
    values.push(data.password);
  }
  if (data.role) {
    updates.push('role = ?');
    values.push(data.role);
  }
  
  if (updates.length === 0) {
    return existingUser;
  }
  
  updates.push('updated_at = ?');
  values.push(now);
  values.push(id);
  
  try {
    const stmt = db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    
    const updatedUser = getUserById(id)!;
    
    createAuditLog({
      operationType: OperationType.UPDATE,
      targetType: 'user',
      targetId: id,
      userId: operator.id,
      userName: operator.name,
      detail: `更新用户: ${existingUser.name}`,
      success: true
    });
    
    return updatedUser;
  } catch (error: any) {
    createAuditLog({
      operationType: OperationType.UPDATE,
      targetType: 'user',
      targetId: id,
      userId: operator.id,
      userName: operator.name,
      detail: `更新用户失败: ${existingUser.name}`,
      success: false,
      errorMessage: error.message
    });
    throw error;
  }
}

export function deleteUser(id: string, operator: User): void {
  const db = getDatabase();
  const user = getUserById(id);
  
  if (!user) {
    throw new Error('用户不存在');
  }
  
  try {
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    
    createAuditLog({
      operationType: OperationType.DELETE,
      targetType: 'user',
      targetId: id,
      userId: operator.id,
      userName: operator.name,
      detail: `删除用户: ${user.name}`,
      success: true
    });
  } catch (error: any) {
    createAuditLog({
      operationType: OperationType.DELETE,
      targetType: 'user',
      targetId: id,
      userId: operator.id,
      userName: operator.name,
      detail: `删除用户失败: ${user.name}`,
      success: false,
      errorMessage: error.message
    });
    throw error;
  }
}

export function getUserById(id: string): User | undefined {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT id, username, password, name, role, created_at as createdAt, updated_at as updatedAt
    FROM users WHERE id = ?
  `).get(id) as any;
  
  if (!row) return undefined;
  
  return {
    ...row,
    role: row.role as UserRole
  };
}

export function getUserByUsername(username: string): User | undefined {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT id, username, password, name, role, created_at as createdAt, updated_at as updatedAt
    FROM users WHERE username = ?
  `).get(username) as any;
  
  if (!row) return undefined;
  
  return {
    ...row,
    role: row.role as UserRole
  };
}

export function listUsers(): User[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT id, username, password, name, role, created_at as createdAt, updated_at as updatedAt
    FROM users ORDER BY created_at DESC
  `).all() as any[];
  
  return rows.map(row => ({
    ...row,
    role: row.role as UserRole
  }));
}

export function authenticate(username: string, password: string): User | null {
  const db = getDatabase();
  const user = getUserByUsername(username);
  
  if (!user || user.password !== password) {
    return null;
  }
  
  createAuditLog({
    operationType: OperationType.LOGIN,
    targetType: 'user',
    targetId: user.id,
    userId: user.id,
    userName: user.name,
    detail: `用户登录: ${username}`,
    success: true
  });
  
  return user;
}
