import { getDb, generateId, now } from './database';
import { User, UserRole, AuditLog } from '../types';
import { createHash } from 'crypto';

export class UserModel {
  static create(data: Omit<User, 'id' | 'passwordHash' | 'createdAt' | 'updatedAt'>, password: string): User {
    const db = getDb();
    const id = generateId();
    const passwordHash = this.hashPassword(password);
    const createdAt = now();
    const updatedAt = now();
    
    const stmt = db.prepare(`
      INSERT INTO users (id, username, name, phone, role, password_hash, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, data.username, data.name, data.phone, data.role, passwordHash, data.isActive ? 1 : 0, createdAt, updatedAt);
    
    return this.getById(id)!;
  }

  static getById(id: string): User | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  static getByUsername(username: string): User | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
    return row ? this.mapRow(row) : null;
  }

  static listByRole(role: UserRole): User[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM users WHERE role = ? AND is_active = 1 ORDER BY name').all(role) as any[];
    return rows.map(row => this.mapRow(row));
  }

  static verifyPassword(id: string, password: string): boolean {
    const db = getDb();
    const result = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(id) as any;
    if (!result) return false;
    return result.password_hash === this.hashPassword(password);
  }

  private static hashPassword(password: string): string {
    return createHash('sha256').update(password).digest('hex');
  }

  private static mapRow(row: any): User {
    return {
      id: row.id,
      username: row.username,
      name: row.name,
      phone: row.phone,
      role: row.role as UserRole,
      passwordHash: row.password_hash,
      isActive: row.is_active === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export class AuditLogModel {
  static create(data: Omit<AuditLog, 'id' | 'createdAt'>): AuditLog {
    const db = getDb();
    const id = generateId();
    const createdAt = now();
    
    const stmt = db.prepare(`
      INSERT INTO audit_logs (id, operator_id, operator_name, action, entity_type, entity_id,
        old_value, newValue, ip_address, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, data.operatorId, data.operatorName, data.action, data.entityType, data.entityId,
      data.oldValue, data.newValue, data.ipAddress, data.userAgent, createdAt);
    
    return { ...data, id, createdAt };
  }

  static list(filters: {
    operatorId?: string;
    entityType?: string;
    entityId?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
  } = {}): AuditLog[] {
    const db = getDb();
    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: any[] = [];
    
    if (filters.operatorId) {
      sql += ' AND operator_id = ?';
      params.push(filters.operatorId);
    }
    if (filters.entityType) {
      sql += ' AND entity_type = ?';
      params.push(filters.entityType);
    }
    if (filters.entityId) {
      sql += ' AND entity_id = ?';
      params.push(filters.entityId);
    }
    if (filters.action) {
      sql += ' AND action = ?';
      params.push(filters.action);
    }
    if (filters.startDate) {
      sql += ' AND created_at >= ?';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      sql += ' AND created_at <= ?';
      params.push(filters.endDate);
    }
    
    sql += ' ORDER BY created_at DESC LIMIT 1000';
    
    const rows = db.prepare(sql).all(...params) as any[];
    return rows.map(row => ({
      id: row.id,
      operatorId: row.operator_id,
      operatorName: row.operator_name,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      oldValue: row.old_value,
      newValue: row.newValue,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at
    }));
  }
}
