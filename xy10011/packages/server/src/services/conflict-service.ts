import { v4 as uuidv4 } from 'uuid';
import { Conflict, ConflictResolution, Event } from '../types';
import { getDatabase, executeTransaction } from '../database';

class ConflictService {
  detectVersionConflict(
    aggregateId: string,
    incomingEvent: Event,
    existingEvents: Event[]
  ): Conflict | null {
    if (existingEvents.length === 0) return null;

    const latestEvent = existingEvents[existingEvents.length - 1];
    
    if (incomingEvent.previousVersion !== latestEvent.newVersion) {
      return {
        id: uuidv4(),
        eventId1: latestEvent.id,
        eventId2: incomingEvent.id,
        aggregateId,
        type: 'version-mismatch',
        status: 'pending',
        detectedAt: Date.now(),
      };
    }

    return null;
  }

  detectConcurrentEdit(
    aggregateId: string,
    incomingEvent: Event,
    existingEvents: Event[]
  ): Conflict | null {
    const recentEvents = existingEvents.filter(e => 
      e.userId !== incomingEvent.userId &&
      e.timestamp > incomingEvent.timestamp - 5000
    );

    if (recentEvents.length > 0) {
      return {
        id: uuidv4(),
        eventId1: recentEvents[recentEvents.length - 1].id,
        eventId2: incomingEvent.id,
        aggregateId,
        type: 'concurrent-edit',
        status: 'pending',
        detectedAt: Date.now(),
      };
    }

    return null;
  }

  detectDataInconsistency(
    aggregateId: string,
    events: Event[]
  ): Conflict | null {
    for (let i = 1; i < events.length; i++) {
      const prev = events[i - 1];
      const curr = events[i];
      
      if (curr.previousVersion !== prev.newVersion) {
        return {
          id: uuidv4(),
          eventId1: prev.id,
          eventId2: curr.id,
          aggregateId,
          type: 'data-inconsistency',
          status: 'pending',
          detectedAt: Date.now(),
        };
      }
    }

    return null;
  }

  async detectAllConflicts(
    aggregateId: string,
    incomingEvent: Event,
    existingEvents: Event[]
  ): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];
    
    const versionConflict = this.detectVersionConflict(aggregateId, incomingEvent, existingEvents);
    if (versionConflict) conflicts.push(versionConflict);

    const concurrentConflict = this.detectConcurrentEdit(aggregateId, incomingEvent, existingEvents);
    if (concurrentConflict) conflicts.push(concurrentConflict);

    for (const conflict of conflicts) {
      await this.persistConflict(conflict);
    }

    return conflicts;
  }

  async persistConflict(conflict: Conflict): Promise<void> {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO conflicts (
        id, event_id1, event_id2, aggregate_id, 
        conflict_type, status, resolution, detected_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      conflict.id,
      conflict.eventId1,
      conflict.eventId2,
      conflict.aggregateId,
      conflict.type,
      conflict.status,
      conflict.resolution ? JSON.stringify(conflict.resolution) : null,
      conflict.detectedAt
    );
  }

  async resolveConflict(
    conflictId: string,
    resolution: ConflictResolution,
    resolvedBy: string
  ): Promise<Conflict> {
    return executeTransaction(() => {
      const db = getDatabase();
      
      const conflict = this.getConflictById(conflictId);
      if (!conflict) {
        throw new Error(`Conflict ${conflictId} not found`);
      }

      const updatedConflict: Conflict = {
        ...conflict,
        status: 'resolved',
        resolution: {
          ...resolution,
          resolvedBy,
          resolvedAt: Date.now(),
        },
      };

      db.prepare(`
        UPDATE conflicts 
        SET status = ?, resolution = ? 
        WHERE id = ?
      `).run(
        'resolved',
        JSON.stringify(updatedConflict.resolution),
        conflictId
      );

      return updatedConflict;
    });
  }

  getConflictById(conflictId: string): Conflict | null {
    const db = getDatabase();
    const row = db.prepare(`SELECT * FROM conflicts WHERE id = ?`).get(conflictId) as any | undefined;
    return row ? this.deserializeConflict(row) : null;
  }

  getConflictsByAggregate(aggregateId: string, status?: Conflict['status']): Conflict[] {
    const db = getDatabase();
    let query = `SELECT * FROM conflicts WHERE aggregate_id = ?`;
    const params: (string | Conflict['status'])[] = [aggregateId];
    
    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }
    query += ` ORDER BY detected_at DESC`;

    const rows = db.prepare(query).all(...params) as any[];
    return rows.map(this.deserializeConflict);
  }

  getPendingConflicts(limit = 100): Conflict[] {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM conflicts 
      WHERE status = 'pending' 
      ORDER BY detected_at DESC 
      LIMIT ?
    `).all(limit) as any[];
    return rows.map(this.deserializeConflict);
  }

  async mergeEvents(events: Event[]): Promise<Record<string, unknown>> {
    if (events.length === 0) return {};

    const sortedEvents = [...events].sort((a, b) => a.sequence - b.sequence);
    let mergedState: Record<string, unknown> = {};

    for (const event of sortedEvents) {
      mergedState = this.applyEventToState(event, mergedState);
    }

    return mergedState;
  }

  private applyEventToState(
    event: Event,
    state: Record<string, unknown>
  ): Record<string, unknown> {
    if (event.eventType === 'BILL_CREATED' || event.eventType === 'GROUP_CREATED' || event.eventType === 'USER_CREATED') {
      const payload = event.payload as any;
      const entity = payload.bill || payload.group || payload.user || payload;
      return { ...entity } as Record<string, unknown>;
    }

    if (event.eventType === 'BILL_UPDATED' || event.eventType === 'GROUP_UPDATED' || event.eventType === 'USER_UPDATED') {
      const payload = event.payload as any;
      const updates = payload.updates || payload;
      return { ...state, ...updates } as Record<string, unknown>;
    }

    if (event.eventType === 'BILL_DELETED' || event.eventType === 'GROUP_DELETED') {
      return { ...state, deleted: true } as Record<string, unknown>;
    }

    return state;
  }

  private deserializeConflict(row: any): Conflict {
    return {
      id: row.id,
      eventId1: row.event_id1,
      eventId2: row.event_id2,
      aggregateId: row.aggregate_id,
      type: row.conflict_type as Conflict['type'],
      status: row.status as Conflict['status'],
      resolution: row.resolution ? JSON.parse(row.resolution) : undefined,
      detectedAt: row.detected_at,
    };
  }
}

export const conflictService = new ConflictService();
