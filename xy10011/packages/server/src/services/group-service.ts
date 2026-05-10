import { v4 as uuidv4 } from 'uuid';
import { Group } from '../types';
import { getDatabase } from '../database';
import { eventStore } from '../event-store';

class GroupService {
  async createGroup(
    groupData: Omit<Group, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
    userId: string,
    clientId: string,
    metadata?: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<Group> {
    if (metadata?.correlationId) {
      const existingGroup = this.findGroupByCorrelationId(metadata.correlationId);
      if (existingGroup) {
        return existingGroup;
      }
    }

    const now = Date.now();
    const group: Group = {
      ...groupData,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    await eventStore.appendEvent(
      group.id,
      'group',
      'GROUP_CREATED',
      { group },
      userId,
      clientId,
      0,
      metadata
    );

    this.persistGroup(group);
    return group;
  }

  private findGroupByCorrelationId(correlationId: string): Group | null {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT aggregate_id as group_id
      FROM events 
      WHERE correlation_id = ? 
        AND event_type = 'GROUP_CREATED'
    `).get(correlationId) as { group_id: string } | undefined;

    if (row?.group_id) {
      return this.getGroupById(row.group_id);
    }
    return null;
  }

  async updateGroup(
    groupId: string,
    updates: Partial<Group>,
    userId: string,
    clientId: string,
    expectedVersion: number,
    metadata?: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<Group> {
    const existingGroup = this.getGroupById(groupId);
    if (!existingGroup) {
      throw new Error(`Group ${groupId} not found`);
    }

    const updatedGroup: Group = {
      ...existingGroup,
      ...updates,
      updatedAt: Date.now(),
      version: expectedVersion + 1,
    };

    await eventStore.appendEvent(
      groupId,
      'group',
      'GROUP_UPDATED',
      { updates },
      userId,
      clientId,
      expectedVersion,
      metadata
    );

    this.updatePersistedGroup(updatedGroup);
    return updatedGroup;
  }

  getGroupById(groupId: string): Group | null {
    const db = getDatabase();
    const row = db.prepare(`SELECT * FROM groups_table WHERE id = ?`).get(groupId) as any | undefined;
    return row ? this.deserializeGroup(row) : null;
  }

  getGroupsForUser(userId: string): Group[] {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM groups_table 
      WHERE members LIKE ? 
      ORDER BY updated_at DESC
    `).all(`%${userId}%`) as any[];
    
    return rows
      .map(this.deserializeGroup)
      .filter(group => group.members.includes(userId));
  }

  private persistGroup(group: Group): void {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO groups_table (
        id, name, description, members, created_by, created_at, updated_at, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      group.id,
      group.name,
      group.description || null,
      JSON.stringify(group.members),
      group.createdBy,
      group.createdAt,
      group.updatedAt,
      group.version
    );
  }

  private updatePersistedGroup(group: Group): void {
    const db = getDatabase();
    db.prepare(`
      UPDATE groups_table SET
        name = ?, description = ?, members = ?, updated_at = ?, version = ?
      WHERE id = ?
    `).run(
      group.name,
      group.description || null,
      JSON.stringify(group.members),
      group.updatedAt,
      group.version,
      group.id
    );
  }

  private deserializeGroup(row: any): Group {
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

export const groupService = new GroupService();
