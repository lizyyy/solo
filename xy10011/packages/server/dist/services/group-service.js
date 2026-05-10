"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupService = void 0;
const uuid_1 = require("uuid");
const database_1 = require("../database");
const event_store_1 = require("../event-store");
class GroupService {
    async createGroup(groupData, userId, clientId, metadata) {
        const now = Date.now();
        const group = {
            ...groupData,
            id: (0, uuid_1.v4)(),
            createdAt: now,
            updatedAt: now,
            version: 1,
        };
        await event_store_1.eventStore.appendEvent(group.id, 'group', 'GROUP_CREATED', { group }, userId, clientId, 0, metadata);
        this.persistGroup(group);
        return group;
    }
    async updateGroup(groupId, updates, userId, clientId, expectedVersion, metadata) {
        const existingGroup = this.getGroupById(groupId);
        if (!existingGroup) {
            throw new Error(`Group ${groupId} not found`);
        }
        const updatedGroup = {
            ...existingGroup,
            ...updates,
            updatedAt: Date.now(),
            version: expectedVersion + 1,
        };
        await event_store_1.eventStore.appendEvent(groupId, 'group', 'GROUP_UPDATED', { updates }, userId, clientId, expectedVersion, metadata);
        this.updatePersistedGroup(updatedGroup);
        return updatedGroup;
    }
    getGroupById(groupId) {
        const db = (0, database_1.getDatabase)();
        const row = db.prepare(`SELECT * FROM groups_table WHERE id = ?`).get(groupId);
        return row ? this.deserializeGroup(row) : null;
    }
    getGroupsForUser(userId) {
        const db = (0, database_1.getDatabase)();
        const rows = db.prepare(`
      SELECT * FROM groups_table 
      WHERE members LIKE ? 
      ORDER BY updated_at DESC
    `).all(`%${userId}%`);
        return rows
            .map(this.deserializeGroup)
            .filter(group => group.members.includes(userId));
    }
    persistGroup(group) {
        const db = (0, database_1.getDatabase)();
        db.prepare(`
      INSERT INTO groups_table (
        id, name, description, members, created_by, created_at, updated_at, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(group.id, group.name, group.description || null, JSON.stringify(group.members), group.createdBy, group.createdAt, group.updatedAt, group.version);
    }
    updatePersistedGroup(group) {
        const db = (0, database_1.getDatabase)();
        db.prepare(`
      UPDATE groups_table SET
        name = ?, description = ?, members = ?, updated_at = ?, version = ?
      WHERE id = ?
    `).run(group.name, group.description || null, JSON.stringify(group.members), group.updatedAt, group.version, group.id);
    }
    deserializeGroup(row) {
        return {
            id: row.id,
            name: row.name,
            description: row.description || undefined,
            members: JSON.parse(row.members),
            createdBy: row.created_by,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            version: row.version,
        };
    }
}
exports.groupService = new GroupService();
