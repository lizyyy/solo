"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUser = createUser;
exports.updateUser = updateUser;
exports.deleteUser = deleteUser;
exports.getUserById = getUserById;
exports.getUserByUsername = getUserByUsername;
exports.listUsers = listUsers;
exports.authenticate = authenticate;
const uuid_1 = require("uuid");
const types_1 = require("../../shared/types");
const database_1 = require("../database");
const auditService_1 = require("./auditService");
function createUser(data, operator) {
    const db = (0, database_1.getDatabase)();
    const now = new Date().toISOString();
    const id = (0, uuid_1.v4)();
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
        const user = getUserById(id);
        (0, auditService_1.createAuditLog)({
            operationType: types_1.OperationType.CREATE,
            targetType: 'user',
            targetId: id,
            userId: operator.id,
            userName: operator.name,
            detail: `创建用户: ${data.name} (${data.username})`,
            success: true
        });
        return user;
    }
    catch (error) {
        (0, auditService_1.createAuditLog)({
            operationType: types_1.OperationType.CREATE,
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
function updateUser(id, data, operator) {
    const db = (0, database_1.getDatabase)();
    const now = new Date().toISOString();
    const existingUser = getUserById(id);
    if (!existingUser) {
        throw new Error('用户不存在');
    }
    const updates = [];
    const values = [];
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
        const updatedUser = getUserById(id);
        (0, auditService_1.createAuditLog)({
            operationType: types_1.OperationType.UPDATE,
            targetType: 'user',
            targetId: id,
            userId: operator.id,
            userName: operator.name,
            detail: `更新用户: ${existingUser.name}`,
            success: true
        });
        return updatedUser;
    }
    catch (error) {
        (0, auditService_1.createAuditLog)({
            operationType: types_1.OperationType.UPDATE,
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
function deleteUser(id, operator) {
    const db = (0, database_1.getDatabase)();
    const user = getUserById(id);
    if (!user) {
        throw new Error('用户不存在');
    }
    try {
        db.prepare('DELETE FROM users WHERE id = ?').run(id);
        (0, auditService_1.createAuditLog)({
            operationType: types_1.OperationType.DELETE,
            targetType: 'user',
            targetId: id,
            userId: operator.id,
            userName: operator.name,
            detail: `删除用户: ${user.name}`,
            success: true
        });
    }
    catch (error) {
        (0, auditService_1.createAuditLog)({
            operationType: types_1.OperationType.DELETE,
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
function getUserById(id) {
    const db = (0, database_1.getDatabase)();
    const row = db.prepare(`
    SELECT id, username, password, name, role, created_at as createdAt, updated_at as updatedAt
    FROM users WHERE id = ?
  `).get(id);
    if (!row)
        return undefined;
    return {
        ...row,
        role: row.role
    };
}
function getUserByUsername(username) {
    const db = (0, database_1.getDatabase)();
    const row = db.prepare(`
    SELECT id, username, password, name, role, created_at as createdAt, updated_at as updatedAt
    FROM users WHERE username = ?
  `).get(username);
    if (!row)
        return undefined;
    return {
        ...row,
        role: row.role
    };
}
function listUsers() {
    const db = (0, database_1.getDatabase)();
    const rows = db.prepare(`
    SELECT id, username, password, name, role, created_at as createdAt, updated_at as updatedAt
    FROM users ORDER BY created_at DESC
  `).all();
    return rows.map(row => ({
        ...row,
        role: row.role
    }));
}
function authenticate(username, password) {
    const db = (0, database_1.getDatabase)();
    const user = getUserByUsername(username);
    if (!user || user.password !== password) {
        return null;
    }
    (0, auditService_1.createAuditLog)({
        operationType: types_1.OperationType.LOGIN,
        targetType: 'user',
        targetId: user.id,
        userId: user.id,
        userName: user.name,
        detail: `用户登录: ${username}`,
        success: true
    });
    return user;
}
