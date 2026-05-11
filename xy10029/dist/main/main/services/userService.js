"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUser = createUser;
exports.getUserById = getUserById;
exports.getUserByUsername = getUserByUsername;
exports.getUserPermissions = getUserPermissions;
exports.hasPermission = hasPermission;
exports.listUsers = listUsers;
exports.updateUser = updateUser;
exports.updateUserPassword = updateUserPassword;
exports.resetUserPassword = resetUserPassword;
exports.verifyUser = verifyUser;
const index_1 = require("../database/index");
const types_1 = require("@shared/types");
const utils_1 = require("@shared/utils");
const crypto_1 = require("crypto");
function hashPassword(password) {
    return (0, crypto_1.createHash)('sha256').update(password).digest('hex');
}
async function createUser(username, password, displayName, role) {
    const now = (0, utils_1.getCurrentTimestamp)();
    const user = {
        id: (0, utils_1.generateId)(),
        username,
        password: hashPassword(password),
        displayName,
        role,
        createdAt: now,
        updatedAt: now,
        isActive: true
    };
    await (0, index_1.run)(`
    INSERT INTO users (id, username, password, display_name, role, created_at, updated_at, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
        user.id,
        user.username,
        user.password,
        user.displayName,
        user.role,
        user.createdAt,
        user.updatedAt,
        user.isActive ? 1 : 0
    ]);
    return user;
}
async function getUserById(id) {
    const row = await (0, index_1.get)('SELECT * FROM users WHERE id = ?', [id]);
    return row ? mapUser(row) : null;
}
async function getUserByUsername(username) {
    const row = await (0, index_1.get)('SELECT * FROM users WHERE username = ?', [username]);
    return row ? mapUser(row) : null;
}
function getUserPermissions(user) {
    return types_1.RolePermissions[user.role] || [];
}
function hasPermission(user, permission) {
    const permissions = getUserPermissions(user);
    return permissions.includes(permission);
}
async function listUsers(params) {
    const { page, pageSize, sortBy = 'created_at', sortOrder = 'desc' } = params;
    const countRow = await (0, index_1.get)('SELECT COUNT(*) as count FROM users', []);
    const total = countRow?.count || 0;
    const offset = (page - 1) * pageSize;
    const rows = await (0, index_1.all)(`SELECT * FROM users ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`, [pageSize, offset]);
    return {
        items: rows.map(mapUser),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
    };
}
async function updateUser(id, updates) {
    const user = await getUserById(id);
    if (!user)
        return null;
    const now = (0, utils_1.getCurrentTimestamp)();
    const updatesToApply = [];
    const values = [];
    if (updates.displayName !== undefined) {
        updatesToApply.push('display_name = ?');
        values.push(updates.displayName);
    }
    if (updates.role !== undefined) {
        updatesToApply.push('role = ?');
        values.push(updates.role);
    }
    if (updates.isActive !== undefined) {
        updatesToApply.push('is_active = ?');
        values.push(updates.isActive ? 1 : 0);
    }
    if (updatesToApply.length === 0)
        return user;
    updatesToApply.push('updated_at = ?');
    values.push(now);
    values.push(id);
    await (0, index_1.run)(`UPDATE users SET ${updatesToApply.join(', ')} WHERE id = ?`, values);
    return getUserById(id);
}
async function updateUserPassword(id, newPassword) {
    const now = (0, utils_1.getCurrentTimestamp)();
    const hashedPassword = hashPassword(newPassword);
    const result = await (0, index_1.run)('UPDATE users SET password = ?, updated_at = ? WHERE id = ?', [hashedPassword, now, id]);
    return result.changes > 0;
}
async function resetUserPassword(id, newPassword) {
    const password = newPassword || (0, utils_1.generateId)().slice(0, 8);
    await updateUserPassword(id, password);
    return password;
}
async function verifyUser(username, password) {
    const user = await getUserByUsername(username);
    if (!user)
        return null;
    if (!user.isActive)
        return null;
    const hashedPassword = hashPassword(password);
    if (user.password === hashedPassword) {
        return { ...user, password: '***' };
    }
    return null;
}
function mapUser(row) {
    return {
        id: row.id,
        username: row.username,
        password: row.password,
        displayName: row.display_name,
        role: row.role,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        isActive: row.is_active === 1
    };
}
//# sourceMappingURL=userService.js.map