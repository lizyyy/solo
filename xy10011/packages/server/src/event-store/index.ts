import { v4 as uuidv4 } from 'uuid';
import { Event, EventType } from '../types';
import { getDatabase, executeTransaction } from '../database';

class EventStore {
  private sequenceCounter: Map<string, number> = new Map();

  async appendEvent(
    aggregateId: string,
    aggregateType: 'bill' | 'group' | 'user' | 'system',
    eventType: EventType,
    payload: Record<string, unknown>,
    userId: string,
    clientId: string,
    expectedVersion: number,
    metadata?: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<Event> {
    return executeTransaction(() => {
      const db = getDatabase();
      
      const currentVersion = this.getCurrentVersion(aggregateId);
      
      if (currentVersion !== expectedVersion && expectedVersion > 0) {
        throw new VersionConflictError(
          aggregateId,
          expectedVersion,
          currentVersion
        );
      }

      const sequence = this.getNextSequence(aggregateId);
      const event: Event = {
        id: uuidv4(),
        eventType,
        aggregateId,
        aggregateType,
        payload,
        previousVersion: currentVersion,
        newVersion: currentVersion + 1,
        userId,
        timestamp: Date.now(),
        clientId,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        correlationId: metadata?.correlationId,
        sequence,
      };

      this.persistEvent(event);
      return event;
    });
  }

  private getCurrentVersion(aggregateId: string): number {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT MAX(new_version) as version FROM events 
      WHERE aggregate_id = ?
    `).get(aggregateId) as { version: number | null } | undefined;
    
    return row?.version || 0;
  }

  private getNextSequence(aggregateId: string): number {
    const current = this.sequenceCounter.get(aggregateId) || 0;
    const next = current + 1;
    this.sequenceCounter.set(aggregateId, next);
    return next;
  }

  private persistEvent(event: Event): void {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO events (
        id, event_type, aggregate_id, aggregate_type, payload,
        previous_version, new_version, user_id, timestamp,
        client_id, ip_address, user_agent, correlation_id, sequence
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.id,
      event.eventType,
      event.aggregateId,
      event.aggregateType,
      JSON.stringify(event.payload),
      event.previousVersion,
      event.newVersion,
      event.userId,
      event.timestamp,
      event.clientId,
      event.ipAddress || null,
      event.userAgent || null,
      event.correlationId || null,
      event.sequence
    );
  }

  getEventsByAggregate(aggregateId: string, fromVersion?: number): Event[] {
    const db = getDatabase();
    let query = `SELECT * FROM events WHERE aggregate_id = ?`;
    const params: (string | number)[] = [aggregateId];
    
    if (fromVersion !== undefined) {
      query += ` AND new_version > ?`;
      params.push(fromVersion);
    }
    query += ` ORDER BY sequence ASC`;

    const rows = db.prepare(query).all(...params) as any[];
    return rows.map(this.deserializeEvent);
  }

  getEventsByType(eventType: EventType, limit = 100): Event[] {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM events 
      WHERE event_type = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `).all(eventType, limit) as any[];
    return rows.map(this.deserializeEvent);
  }

  getEventsByUser(userId: string, limit = 100): Event[] {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM events 
      WHERE user_id = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `).all(userId, limit) as any[];
    return rows.map(this.deserializeEvent);
  }

  getEventsByTimeRange(startTime: number, endTime: number): Event[] {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM events 
      WHERE timestamp >= ? AND timestamp <= ? 
      ORDER BY timestamp ASC
    `).all(startTime, endTime) as any[];
    return rows.map(this.deserializeEvent);
  }

  getEventById(eventId: string): Event | null {
    const db = getDatabase();
    const row = db.prepare(`SELECT * FROM events WHERE id = ?`).get(eventId) as any | undefined;
    return row ? this.deserializeEvent(row) : null;
  }

  replayEvents(aggregateId: string, untilVersion?: number): Event[] {
    const events = this.getEventsByAggregate(aggregateId);
    if (untilVersion === undefined) return events;
    return events.filter(e => e.newVersion <= untilVersion);
  }

  private deserializeEvent(row: any): Event {
    return {
      id: row.id,
      eventType: row.event_type as EventType,
      aggregateId: row.aggregate_id,
      aggregateType: row.aggregate_type as Event['aggregateType'],
      payload: JSON.parse(row.payload),
      previousVersion: row.previous_version,
      newVersion: row.new_version,
      userId: row.user_id,
      timestamp: row.timestamp,
      clientId: row.client_id,
      ipAddress: row.ip_address || undefined,
      userAgent: row.user_agent || undefined,
      correlationId: row.correlation_id || undefined,
      sequence: row.sequence,
    };
  }
}

export class VersionConflictError extends Error {
  aggregateId: string;
  expectedVersion: number;
  actualVersion: number;

  constructor(aggregateId: string, expectedVersion: number, actualVersion: number) {
    super(`Version conflict for aggregate ${aggregateId}: expected ${expectedVersion}, got ${actualVersion}`);
    this.name = 'VersionConflictError';
    this.aggregateId = aggregateId;
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}

export const eventStore = new EventStore();
