import { v4 as uuidv4 } from 'uuid';
import { Database } from 'sqlite';
import { DatabaseManager } from './database';
import { Ticket, Cabinet, MaintenanceRecord, AuditLog, TicketStatus, RuleResult } from '../types';

export class TicketRepository {
  private async getDb(): Promise<Database> {
    const dbManager = DatabaseManager.getInstance();
    if (!dbManager.isInitialized()) {
      await dbManager.initialize();
    }
    return dbManager.getConnection();
  }

  async create(ticket: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt'>): Promise<Ticket> {
    const db = await this.getDb();
    const now = new Date();
    const id = uuidv4();
    const newTicket: Ticket = {
      ...ticket,
      id,
      createdAt: now,
      updatedAt: now,
    };

    await db.run(`
      INSERT INTO tickets (
        id, externalId, cabinetId, cabinetName, faultType, description, status,
        isOffline, reportedAt, receivedAt, analyzedAt, dispatchedAt, reviewedAt,
        resolvedAt, assignedTo, rootCause, resolution, mergedInto, mergedTickets,
        ruleResults, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      id,
      newTicket.externalId,
      newTicket.cabinetId,
      newTicket.cabinetName,
      newTicket.faultType,
      newTicket.description,
      newTicket.status,
      newTicket.isOffline ? 1 : 0,
      newTicket.reportedAt.toISOString(),
      newTicket.receivedAt?.toISOString() || null,
      newTicket.analyzedAt?.toISOString() || null,
      newTicket.dispatchedAt?.toISOString() || null,
      newTicket.reviewedAt?.toISOString() || null,
      newTicket.resolvedAt?.toISOString() || null,
      newTicket.assignedTo || null,
      newTicket.rootCause || null,
      newTicket.resolution || null,
      newTicket.mergedInto || null,
      JSON.stringify(newTicket.mergedTickets),
      JSON.stringify(newTicket.ruleResults),
      newTicket.createdAt.toISOString(),
      newTicket.updatedAt.toISOString()
    );

    return newTicket;
  }

  async update(id: string, updates: Partial<Ticket>): Promise<Ticket | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const updated = { ...existing, ...updates, updatedAt: new Date() };
    const db = await this.getDb();

    await db.run(`
      UPDATE tickets SET
        externalId = COALESCE(?, externalId),
        cabinetId = COALESCE(?, cabinetId),
        cabinetName = COALESCE(?, cabinetName),
        faultType = COALESCE(?, faultType),
        description = COALESCE(?, description),
        status = COALESCE(?, status),
        isOffline = COALESCE(?, isOffline),
        reportedAt = COALESCE(?, reportedAt),
        receivedAt = ?,
        analyzedAt = ?,
        dispatchedAt = ?,
        reviewedAt = ?,
        resolvedAt = ?,
        assignedTo = ?,
        rootCause = ?,
        resolution = ?,
        mergedInto = ?,
        mergedTickets = ?,
        ruleResults = ?,
        updatedAt = ?
      WHERE id = ?
    `,
      updated.externalId,
      updated.cabinetId,
      updated.cabinetName,
      updated.faultType,
      updated.description,
      updated.status,
      updated.isOffline ? 1 : 0,
      updated.reportedAt.toISOString(),
      updated.receivedAt?.toISOString() || null,
      updated.analyzedAt?.toISOString() || null,
      updated.dispatchedAt?.toISOString() || null,
      updated.reviewedAt?.toISOString() || null,
      updated.resolvedAt?.toISOString() || null,
      updated.assignedTo || null,
      updated.rootCause || null,
      updated.resolution || null,
      updated.mergedInto || null,
      JSON.stringify(updated.mergedTickets),
      JSON.stringify(updated.ruleResults),
      updated.updatedAt.toISOString(),
      id
    );

    return this.findById(id);
  }

  async findById(id: string): Promise<Ticket | null> {
    const db = await this.getDb();
    const row = await db.get('SELECT * FROM tickets WHERE id = ?', id);
    return row ? this.mapRowToTicket(row) : null;
  }

  async findByExternalId(externalId: string): Promise<Ticket | null> {
    const db = await this.getDb();
    const row = await db.get('SELECT * FROM tickets WHERE externalId = ?', externalId);
    return row ? this.mapRowToTicket(row) : null;
  }

  async findByCabinetIdAndFaultType(cabinetId: string, faultType: string, withinHours: number = 24): Promise<Ticket[]> {
    const db = await this.getDb();
    const since = new Date(Date.now() - withinHours * 60 * 60 * 1000);
    const rows = await db.all(`
      SELECT * FROM tickets 
      WHERE cabinetId = ? 
        AND faultType = ? 
        AND reportedAt >= ?
        AND status != ?
        AND mergedInto IS NULL
    `, cabinetId, faultType, since.toISOString(), TicketStatus.RESOLVED);
    
    return rows.map((row: any) => this.mapRowToTicket(row));
  }

  async findAll(filters?: { status?: TicketStatus; cabinetId?: string; startDate?: Date; endDate?: Date }): Promise<Ticket[]> {
    const db = await this.getDb();
    let query = 'SELECT * FROM tickets WHERE 1=1';
    const params: any[] = [];

    if (filters?.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters?.cabinetId) {
      query += ' AND cabinetId = ?';
      params.push(filters.cabinetId);
    }

    if (filters?.startDate) {
      query += ' AND reportedAt >= ?';
      params.push(filters.startDate.toISOString());
    }

    if (filters?.endDate) {
      query += ' AND reportedAt <= ?';
      params.push(filters.endDate.toISOString());
    }

    query += ' ORDER BY reportedAt DESC';

    const rows = await db.all(query, ...params);
    return rows.map((row: any) => this.mapRowToTicket(row));
  }

  private mapRowToTicket(row: any): Ticket {
    return {
      id: row.id,
      externalId: row.externalId,
      cabinetId: row.cabinetId,
      cabinetName: row.cabinetName,
      faultType: row.faultType,
      description: row.description,
      status: row.status,
      isOffline: row.isOffline === 1,
      reportedAt: new Date(row.reportedAt),
      receivedAt: row.receivedAt ? new Date(row.receivedAt) : undefined,
      analyzedAt: row.analyzedAt ? new Date(row.analyzedAt) : undefined,
      dispatchedAt: row.dispatchedAt ? new Date(row.dispatchedAt) : undefined,
      reviewedAt: row.reviewedAt ? new Date(row.reviewedAt) : undefined,
      resolvedAt: row.resolvedAt ? new Date(row.resolvedAt) : undefined,
      assignedTo: row.assignedTo || undefined,
      rootCause: row.rootCause || undefined,
      resolution: row.resolution || undefined,
      mergedInto: row.mergedInto || undefined,
      mergedTickets: JSON.parse(row.mergedTickets || '[]'),
      ruleResults: JSON.parse(row.ruleResults || '[]').map((r: any) => ({
        ...r,
        timestamp: new Date(r.timestamp)
      })),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  async addRuleResult(ticketId: string, ruleResult: RuleResult): Promise<void> {
    const ticket = await this.findById(ticketId);
    if (!ticket) return;

    ticket.ruleResults.push(ruleResult);
    await this.update(ticketId, { ruleResults: ticket.ruleResults });
  }

  async mergeTickets(targetId: string, sourceId: string): Promise<void> {
    const target = await this.findById(targetId);
    const source = await this.findById(sourceId);
    if (!target || !source) return;

    target.mergedTickets.push(sourceId);
    await this.update(targetId, { mergedTickets: target.mergedTickets });
    await this.update(sourceId, { mergedInto: targetId, status: TicketStatus.REJECTED });
  }
}

export class CabinetRepository {
  private async getDb(): Promise<Database> {
    const dbManager = DatabaseManager.getInstance();
    if (!dbManager.isInitialized()) {
      await dbManager.initialize();
    }
    return dbManager.getConnection();
  }

  async create(cabinet: Omit<Cabinet, 'id' | 'createdAt' | 'updatedAt'>): Promise<Cabinet> {
    const db = await this.getDb();
    const now = new Date();
    const id = uuidv4();
    const newCabinet: Cabinet = { ...cabinet, id, createdAt: now, updatedAt: now };

    await db.run(`
      INSERT INTO cabinets (id, name, isOnline, lastHeartbeat, location, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      id,
      newCabinet.name,
      newCabinet.isOnline ? 1 : 0,
      newCabinet.lastHeartbeat.toISOString(),
      newCabinet.location,
      newCabinet.createdAt.toISOString(),
      newCabinet.updatedAt.toISOString()
    );

    return newCabinet;
  }

  async findById(id: string): Promise<Cabinet | null> {
    const db = await this.getDb();
    const row = await db.get('SELECT * FROM cabinets WHERE id = ?', id);
    return row ? this.mapRowToCabinet(row) : null;
  }

  async findAll(): Promise<Cabinet[]> {
    const db = await this.getDb();
    const rows = await db.all('SELECT * FROM cabinets ORDER BY name');
    return rows.map((row: any) => this.mapRowToCabinet(row));
  }

  async updateHeartbeat(id: string): Promise<void> {
    const db = await this.getDb();
    await db.run('UPDATE cabinets SET lastHeartbeat = ?, updatedAt = ? WHERE id = ?',
      new Date().toISOString(), new Date().toISOString(), id);
  }

  async setOnlineStatus(id: string, isOnline: boolean): Promise<void> {
    const db = await this.getDb();
    await db.run('UPDATE cabinets SET isOnline = ?, updatedAt = ? WHERE id = ?',
      isOnline ? 1 : 0, new Date().toISOString(), id);
  }

  private mapRowToCabinet(row: any): Cabinet {
    return {
      id: row.id,
      name: row.name,
      isOnline: row.isOnline === 1,
      lastHeartbeat: new Date(row.lastHeartbeat),
      location: row.location,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
}

export class MaintenanceRecordRepository {
  private async getDb(): Promise<Database> {
    const dbManager = DatabaseManager.getInstance();
    if (!dbManager.isInitialized()) {
      await dbManager.initialize();
    }
    return dbManager.getConnection();
  }

  async create(record: Omit<MaintenanceRecord, 'id' | 'createdAt'>): Promise<MaintenanceRecord> {
    const db = await this.getDb();
    const now = new Date();
    const id = uuidv4();
    const newRecord: MaintenanceRecord = { ...record, id, createdAt: now };

    await db.run(`
      INSERT INTO maintenance_records (
        id, ticketId, cabinetId, technician, scheduledAt, startedAt,
        completedAt, statusBefore, statusAfter, notes, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      id,
      newRecord.ticketId,
      newRecord.cabinetId,
      newRecord.technician,
      newRecord.scheduledAt.toISOString(),
      newRecord.startedAt?.toISOString() || null,
      newRecord.completedAt?.toISOString() || null,
      newRecord.statusBefore,
      newRecord.statusAfter || null,
      newRecord.notes || null,
      newRecord.createdAt.toISOString()
    );

    return newRecord;
  }

  async findByTicketId(ticketId: string): Promise<MaintenanceRecord[]> {
    const db = await this.getDb();
    const rows = await db.all('SELECT * FROM maintenance_records WHERE ticketId = ?', ticketId);
    return rows.map((row: any) => this.mapRowToRecord(row));
  }

  async findByCabinetId(cabinetId: string): Promise<MaintenanceRecord[]> {
    const db = await this.getDb();
    const rows = await db.all('SELECT * FROM maintenance_records WHERE cabinetId = ? ORDER BY scheduledAt DESC', cabinetId);
    return rows.map((row: any) => this.mapRowToRecord(row));
  }

  async update(id: string, updates: Partial<MaintenanceRecord>): Promise<MaintenanceRecord | null> {
    const db = await this.getDb();
    const existing = await db.get('SELECT * FROM maintenance_records WHERE id = ?', id);
    if (!existing) return null;

    const updated = { ...existing, ...updates };

    await db.run(`
      UPDATE maintenance_records SET
        technician = COALESCE(?, technician),
        scheduledAt = COALESCE(?, scheduledAt),
        startedAt = ?,
        completedAt = ?,
        statusBefore = COALESCE(?, statusBefore),
        statusAfter = ?,
        notes = ?
      WHERE id = ?
    `,
      updated.technician,
      updated.scheduledAt?.toISOString(),
      updated.startedAt?.toISOString() || null,
      updated.completedAt?.toISOString() || null,
      updated.statusBefore,
      updated.statusAfter || null,
      updated.notes || null,
      id
    );

    const row = await db.get('SELECT * FROM maintenance_records WHERE id = ?', id);
    return row ? this.mapRowToRecord(row) : null;
  }

  private mapRowToRecord(row: any): MaintenanceRecord {
    return {
      id: row.id,
      ticketId: row.ticketId,
      cabinetId: row.cabinetId,
      technician: row.technician,
      scheduledAt: new Date(row.scheduledAt),
      startedAt: row.startedAt ? new Date(row.startedAt) : undefined,
      completedAt: row.completedAt ? new Date(row.completedAt) : undefined,
      statusBefore: row.statusBefore,
      statusAfter: row.statusAfter || undefined,
      notes: row.notes || undefined,
      createdAt: new Date(row.createdAt),
    };
  }
}

export class AuditLogRepository {
  private async getDb(): Promise<Database> {
    const dbManager = DatabaseManager.getInstance();
    if (!dbManager.isInitialized()) {
      await dbManager.initialize();
    }
    return dbManager.getConnection();
  }

  async create(log: Omit<AuditLog, 'id'>): Promise<AuditLog> {
    const db = await this.getDb();
    const id = uuidv4();
    const newLog: AuditLog = { ...log, id };

    await db.run(`
      INSERT INTO audit_logs (id, ticketId, action, operator, details, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
      id,
      newLog.ticketId || null,
      newLog.action,
      newLog.operator,
      JSON.stringify(newLog.details),
      newLog.timestamp.toISOString()
    );

    return newLog;
  }

  async findByTicketId(ticketId: string): Promise<AuditLog[]> {
    const db = await this.getDb();
    const rows = await db.all('SELECT * FROM audit_logs WHERE ticketId = ? ORDER BY timestamp DESC', ticketId);
    return rows.map((row: any) => this.mapRowToLog(row));
  }

  async findAll(limit: number = 100): Promise<AuditLog[]> {
    const db = await this.getDb();
    const rows = await db.all('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?', limit);
    return rows.map((row: any) => this.mapRowToLog(row));
  }

  private mapRowToLog(row: any): AuditLog {
    return {
      id: row.id,
      ticketId: row.ticketId || undefined,
      action: row.action,
      operator: row.operator,
      details: JSON.parse(row.details || '{}'),
      timestamp: new Date(row.timestamp),
    };
  }
}