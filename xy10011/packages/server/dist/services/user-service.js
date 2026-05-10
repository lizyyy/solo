"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userService = void 0;
const uuid_1 = require("uuid");
const database_1 = require("../database");
const event_store_1 = require("../event-store");
class UserService {
    async getOrCreateUser(userId, options, clientId, metadata) {
        const existingUser = this.getUserById(userId);
        if (existingUser) {
            return existingUser;
        }
        const now = Date.now();
        const user = {
            id: userId,
            name: options?.name || `用户${userId.slice(-6)}`,
            avatar: options?.avatar,
            createdAt: now,
            updatedAt: now,
        };
        await event_store_1.eventStore.appendEvent(userId, 'user', 'USER_CREATED', { user }, userId, clientId || 'system', 0, metadata);
        this.persistUser(user);
        return user;
    }
    async createUser(userData, clientId, metadata) {
        if (metadata?.correlationId) {
            const existingUser = this.findUserByCorrelationId(metadata.correlationId);
            if (existingUser) {
                return existingUser;
            }
        }
        const now = Date.now();
        const user = {
            ...userData,
            id: userData.id || (0, uuid_1.v4)(),
            createdAt: now,
            updatedAt: now,
        };
        await event_store_1.eventStore.appendEvent(user.id, 'user', 'USER_CREATED', { user }, user.id, clientId, 0, metadata);
        this.persistUser(user);
        return user;
    }
    findUserByCorrelationId(correlationId) {
        const db = (0, database_1.getDatabase)();
        const row = db.prepare(`
      SELECT aggregate_id as user_id
      FROM events 
      WHERE correlation_id = ? 
        AND event_type = 'USER_CREATED'
    `).get(correlationId);
        if (row?.user_id) {
            return this.getUserById(row.user_id);
        }
        return null;
    }
    async updateUser(userId, updates, clientId, expectedVersion, metadata) {
        const existingUser = this.getUserById(userId);
        if (!existingUser) {
            throw new Error(`User ${userId} not found`);
        }
        const updatedUser = {
            ...existingUser,
            ...updates,
            updatedAt: Date.now(),
        };
        await event_store_1.eventStore.appendEvent(userId, 'user', 'USER_UPDATED', { updates }, userId, clientId, expectedVersion, metadata);
        this.updatePersistedUser(updatedUser);
        return updatedUser;
    }
    getUserById(userId) {
        const db = (0, database_1.getDatabase)();
        const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        return row ? this.deserializeUser(row) : null;
    }
    getAllUsers() {
        const db = (0, database_1.getDatabase)();
        const rows = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
        return rows.map(this.deserializeUser);
    }
    persistUser(user) {
        const db = (0, database_1.getDatabase)();
        db.prepare(`
      INSERT INTO users (id, name, avatar, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(user.id, user.name, user.avatar || null, user.createdAt, user.updatedAt);
    }
    updatePersistedUser(user) {
        const db = (0, database_1.getDatabase)();
        db.prepare(`
      UPDATE users SET
        name = ?,
        avatar = ?,
        updated_at = ?
      WHERE id = ?
    `).run(user.name, user.avatar || null, user.updatedAt, user.id);
    }
    deserializeUser(row) {
        return {
            id: row.id,
            name: row.name,
            avatar: row.avatar || undefined,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
}
exports.userService = new UserService();
