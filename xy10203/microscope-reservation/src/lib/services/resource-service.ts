import db from '../db';
import { generateId, nowISO } from '../utils';
import { logAction } from './log-service';
import { Microscope, Accessory, ResearchGroup, User } from '../types';

export function createMicroscope(
  data: Omit<Microscope, 'id' | 'created_at' | 'updated_at' | 'is_active'>,
  userId: string
): Microscope {
  const id = generateId();
  const now = nowISO();

  db.prepare(`
    INSERT INTO microscopes (
      id, name, model, location, description, created_at, updated_at, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(id, data.name, data.model || null, data.location || null, data.description || null, now, now);

  logAction({
    entityType: 'microscope',
    entityId: id,
    action: 'create',
    newValues: data,
    userId
  });

  return db.prepare('SELECT * FROM microscopes WHERE id = ?').get(id) as Microscope;
}

export function updateMicroscope(
  id: string,
  data: Partial<Omit<Microscope, 'id' | 'created_at' | 'updated_at'>>,
  userId: string
): Microscope {
  const existing = db.prepare('SELECT * FROM microscopes WHERE id = ?').get(id) as Microscope | undefined;
  if (!existing) {
    throw new Error('显微镜不存在');
  }

  const now = nowISO();
  const updates: string[] = [];
  const params: any[] = [];

  if (data.name !== undefined) { updates.push('name = ?'); params.push(data.name); }
  if (data.model !== undefined) { updates.push('model = ?'); params.push(data.model); }
  if (data.location !== undefined) { updates.push('location = ?'); params.push(data.location); }
  if (data.description !== undefined) { updates.push('description = ?'); params.push(data.description); }
  if (data.is_active !== undefined) { updates.push('is_active = ?'); params.push(data.is_active); }

  updates.push('updated_at = ?');
  params.push(now);
  params.push(id);

  db.prepare(`UPDATE microscopes SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  logAction({
    entityType: 'microscope',
    entityId: id,
    action: 'update',
    oldValues: existing,
    newValues: data,
    userId
  });

  return db.prepare('SELECT * FROM microscopes WHERE id = ?').get(id) as Microscope;
}

export function getMicroscope(id: string): Microscope | undefined {
  return db.prepare('SELECT * FROM microscopes WHERE id = ?').get(id) as Microscope | undefined;
}

export function getAllMicroscopes(includeInactive = false): Microscope[] {
  const query = includeInactive
    ? 'SELECT * FROM microscopes ORDER BY name'
    : 'SELECT * FROM microscopes WHERE is_active = 1 ORDER BY name';
  return db.prepare(query).all() as Microscope[];
}

export function createAccessory(
  data: Omit<Accessory, 'id' | 'created_at' | 'updated_at' | 'is_active'>,
  userId: string
): Accessory {
  const id = generateId();
  const now = nowISO();

  db.prepare(`
    INSERT INTO accessories (
      id, microscope_id, name, type, description, created_at, updated_at, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(id, data.microscope_id, data.name, data.type, data.description || null, now, now);

  logAction({
    entityType: 'accessory',
    entityId: id,
    action: 'create',
    newValues: data,
    userId
  });

  return db.prepare('SELECT * FROM accessories WHERE id = ?').get(id) as Accessory;
}

export function updateAccessory(
  id: string,
  data: Partial<Omit<Accessory, 'id' | 'created_at' | 'updated_at'>>,
  userId: string
): Accessory {
  const existing = db.prepare('SELECT * FROM accessories WHERE id = ?').get(id) as Accessory | undefined;
  if (!existing) {
    throw new Error('附件不存在');
  }

  const now = nowISO();
  const updates: string[] = [];
  const params: any[] = [];

  if (data.name !== undefined) { updates.push('name = ?'); params.push(data.name); }
  if (data.type !== undefined) { updates.push('type = ?'); params.push(data.type); }
  if (data.description !== undefined) { updates.push('description = ?'); params.push(data.description); }
  if (data.is_active !== undefined) { updates.push('is_active = ?'); params.push(data.is_active); }

  updates.push('updated_at = ?');
  params.push(now);
  params.push(id);

  db.prepare(`UPDATE accessories SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  logAction({
    entityType: 'accessory',
    entityId: id,
    action: 'update',
    oldValues: existing,
    newValues: data,
    userId
  });

  return db.prepare('SELECT * FROM accessories WHERE id = ?').get(id) as Accessory;
}

export function getAccessory(id: string): Accessory | undefined {
  return db.prepare('SELECT * FROM accessories WHERE id = ?').get(id) as Accessory | undefined;
}

export function getAccessoriesByMicroscope(microscopeId: string, includeInactive = false): Accessory[] {
  const query = includeInactive
    ? 'SELECT * FROM accessories WHERE microscope_id = ? ORDER BY type, name'
    : 'SELECT * FROM accessories WHERE microscope_id = ? AND is_active = 1 ORDER BY type, name';
  return db.prepare(query).all(microscopeId) as Accessory[];
}

export function createResearchGroup(
  data: Omit<ResearchGroup, 'id' | 'created_at' | 'updated_at'>,
  userId: string
): ResearchGroup {
  const id = generateId();
  const now = nowISO();

  db.prepare(`
    INSERT INTO research_groups (id, name, leader, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, data.name, data.leader || null, now, now);

  logAction({
    entityType: 'research_group',
    entityId: id,
    action: 'create',
    newValues: data,
    userId
  });

  return db.prepare('SELECT * FROM research_groups WHERE id = ?').get(id) as ResearchGroup;
}

export function updateResearchGroup(
  id: string,
  data: Partial<Omit<ResearchGroup, 'id' | 'created_at' | 'updated_at'>>,
  userId: string
): ResearchGroup {
  const existing = db.prepare('SELECT * FROM research_groups WHERE id = ?').get(id) as ResearchGroup | undefined;
  if (!existing) {
    throw new Error('课题组不存在');
  }

  const now = nowISO();
  const updates: string[] = [];
  const params: any[] = [];

  if (data.name !== undefined) { updates.push('name = ?'); params.push(data.name); }
  if (data.leader !== undefined) { updates.push('leader = ?'); params.push(data.leader); }

  updates.push('updated_at = ?');
  params.push(now);
  params.push(id);

  db.prepare(`UPDATE research_groups SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  logAction({
    entityType: 'research_group',
    entityId: id,
    action: 'update',
    oldValues: existing,
    newValues: data,
    userId
  });

  return db.prepare('SELECT * FROM research_groups WHERE id = ?').get(id) as ResearchGroup;
}

export function getAllResearchGroups(): ResearchGroup[] {
  return db.prepare('SELECT * FROM research_groups ORDER BY name').all() as ResearchGroup[];
}

export function createUser(
  data: Omit<User, 'id' | 'created_at'>,
  userId: string
): User {
  const id = generateId();
  const now = nowISO();

  db.prepare(`
    INSERT INTO users (id, name, email, group_id, role, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, data.name, data.email || null, data.group_id || null, data.role, now);

  logAction({
    entityType: 'user',
    entityId: id,
    action: 'create',
    newValues: data,
    userId
  });

  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User;
}

export function getUser(id: string): User | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
}

export function getAllUsers(): User[] {
  return db.prepare('SELECT * FROM users ORDER BY name').all() as User[];
}

export function getUsersByGroup(groupId: string): User[] {
  return db.prepare('SELECT * FROM users WHERE group_id = ? ORDER BY name').all(groupId) as User[];
}
