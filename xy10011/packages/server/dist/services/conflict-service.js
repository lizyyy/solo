"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.conflictService = void 0;
const uuid_1 = require("uuid");
const database_1 = require("../database");
class ConflictService {
    detectVersionConflict(aggregateId, incomingEvent, existingEvents) {
        if (existingEvents.length === 0)
            return null;
        const latestEvent = existingEvents[existingEvents.length - 1];
        if (incomingEvent.previousVersion !== latestEvent.newVersion) {
            return {
                id: (0, uuid_1.v4)(),
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
    detectConcurrentEdit(aggregateId, incomingEvent, existingEvents) {
        const recentEvents = existingEvents.filter(e => e.userId !== incomingEvent.userId &&
            e.timestamp > incomingEvent.timestamp - 5000);
        if (recentEvents.length > 0) {
            return {
                id: (0, uuid_1.v4)(),
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
    detectDataInconsistency(aggregateId, events) {
        for (let i = 1; i < events.length; i++) {
            const prev = events[i - 1];
            const curr = events[i];
            if (curr.previousVersion !== prev.newVersion) {
                return {
                    id: (0, uuid_1.v4)(),
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
    async detectAllConflicts(aggregateId, incomingEvent, existingEvents) {
        const conflicts = [];
        const versionConflict = this.detectVersionConflict(aggregateId, incomingEvent, existingEvents);
        if (versionConflict)
            conflicts.push(versionConflict);
        const concurrentConflict = this.detectConcurrentEdit(aggregateId, incomingEvent, existingEvents);
        if (concurrentConflict)
            conflicts.push(concurrentConflict);
        for (const conflict of conflicts) {
            await this.persistConflict(conflict);
        }
        return conflicts;
    }
    async persistConflict(conflict) {
        const db = (0, database_1.getDatabase)();
        db.prepare(`
      INSERT INTO conflicts (
        id, event_id1, event_id2, aggregate_id, 
        conflict_type, status, resolution, detected_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(conflict.id, conflict.eventId1, conflict.eventId2, conflict.aggregateId, conflict.type, conflict.status, conflict.resolution ? JSON.stringify(conflict.resolution) : null, conflict.detectedAt);
    }
    async resolveConflict(conflictId, resolution, resolvedBy) {
        return (0, database_1.executeTransaction)(() => {
            const db = (0, database_1.getDatabase)();
            const conflict = this.getConflictById(conflictId);
            if (!conflict) {
                throw new Error(`Conflict ${conflictId} not found`);
            }
            const updatedConflict = {
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
      `).run('resolved', JSON.stringify(updatedConflict.resolution), conflictId);
            return updatedConflict;
        });
    }
    getConflictById(conflictId) {
        const db = (0, database_1.getDatabase)();
        const row = db.prepare(`SELECT * FROM conflicts WHERE id = ?`).get(conflictId);
        return row ? this.deserializeConflict(row) : null;
    }
    getConflictsByAggregate(aggregateId, status) {
        const db = (0, database_1.getDatabase)();
        let query = `SELECT * FROM conflicts WHERE aggregate_id = ?`;
        const params = [aggregateId];
        if (status) {
            query += ` AND status = ?`;
            params.push(status);
        }
        query += ` ORDER BY detected_at DESC`;
        const rows = db.prepare(query).all(...params);
        return rows.map(this.deserializeConflict);
    }
    getPendingConflicts(limit = 100) {
        const db = (0, database_1.getDatabase)();
        const rows = db.prepare(`
      SELECT * FROM conflicts 
      WHERE status = 'pending' 
      ORDER BY detected_at DESC 
      LIMIT ?
    `).all(limit);
        return rows.map(this.deserializeConflict);
    }
    async mergeEvents(events) {
        if (events.length === 0)
            return {};
        const sortedEvents = [...events].sort((a, b) => a.sequence - b.sequence);
        let mergedState = {};
        for (const event of sortedEvents) {
            mergedState = this.applyEventToState(event, mergedState);
        }
        return mergedState;
    }
    applyEventToState(event, state) {
        if (event.eventType === 'BILL_CREATED' || event.eventType === 'GROUP_CREATED' || event.eventType === 'USER_CREATED') {
            const payload = event.payload;
            const entity = payload.bill || payload.group || payload.user || payload;
            return { ...entity };
        }
        if (event.eventType === 'BILL_UPDATED' || event.eventType === 'GROUP_UPDATED' || event.eventType === 'USER_UPDATED') {
            const payload = event.payload;
            const updates = payload.updates || payload;
            return { ...state, ...updates };
        }
        if (event.eventType === 'BILL_DELETED' || event.eventType === 'GROUP_DELETED') {
            return { ...state, deleted: true };
        }
        return state;
    }
    deserializeConflict(row) {
        return {
            id: row.id,
            eventId1: row.event_id1,
            eventId2: row.event_id2,
            aggregateId: row.aggregate_id,
            type: row.conflict_type,
            status: row.status,
            resolution: row.resolution ? JSON.parse(row.resolution) : undefined,
            detectedAt: row.detected_at,
        };
    }
}
exports.conflictService = new ConflictService();
