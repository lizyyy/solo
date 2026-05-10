"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventStore = exports.VersionConflictError = void 0;
const uuid_1 = require("uuid");
const database_1 = require("../database");
class EventStore {
    sequenceCounter = new Map();
    async appendEvent(aggregateId, aggregateType, eventType, payload, userId, clientId, expectedVersion, metadata) {
        return (0, database_1.executeTransaction)(() => {
            const db = (0, database_1.getDatabase)();
            const currentVersion = this.getCurrentVersion(aggregateId);
            if (currentVersion !== expectedVersion) {
                throw new VersionConflictError(aggregateId, expectedVersion, currentVersion);
            }
            const sequence = this.getNextSequence(aggregateId);
            const event = {
                id: (0, uuid_1.v4)(),
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
    getCurrentVersion(aggregateId) {
        const db = (0, database_1.getDatabase)();
        const row = db.prepare(`
      SELECT MAX(new_version) as version FROM events 
      WHERE aggregate_id = ?
    `).get(aggregateId);
        return row?.version || 0;
    }
    getNextSequence(aggregateId) {
        const current = this.sequenceCounter.get(aggregateId) || 0;
        const next = current + 1;
        this.sequenceCounter.set(aggregateId, next);
        return next;
    }
    persistEvent(event) {
        const db = (0, database_1.getDatabase)();
        db.prepare(`
      INSERT INTO events (
        id, event_type, aggregate_id, aggregate_type, payload,
        previous_version, new_version, user_id, timestamp,
        client_id, ip_address, user_agent, correlation_id, sequence
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(event.id, event.eventType, event.aggregateId, event.aggregateType, JSON.stringify(event.payload), event.previousVersion, event.newVersion, event.userId, event.timestamp, event.clientId, event.ipAddress || null, event.userAgent || null, event.correlationId || null, event.sequence);
    }
    getEventsByAggregate(aggregateId, fromVersion) {
        const db = (0, database_1.getDatabase)();
        let query = `SELECT * FROM events WHERE aggregate_id = ?`;
        const params = [aggregateId];
        if (fromVersion !== undefined) {
            query += ` AND new_version > ?`;
            params.push(fromVersion);
        }
        query += ` ORDER BY sequence ASC`;
        const rows = db.prepare(query).all(...params);
        return rows.map(this.deserializeEvent);
    }
    getEventsByType(eventType, limit = 100) {
        const db = (0, database_1.getDatabase)();
        const rows = db.prepare(`
      SELECT * FROM events 
      WHERE event_type = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `).all(eventType, limit);
        return rows.map(this.deserializeEvent);
    }
    getEventsByUser(userId, limit = 100) {
        const db = (0, database_1.getDatabase)();
        const rows = db.prepare(`
      SELECT * FROM events 
      WHERE user_id = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `).all(userId, limit);
        return rows.map(this.deserializeEvent);
    }
    getEventsByTimeRange(startTime, endTime) {
        const db = (0, database_1.getDatabase)();
        const rows = db.prepare(`
      SELECT * FROM events 
      WHERE timestamp >= ? AND timestamp <= ? 
      ORDER BY timestamp ASC
    `).all(startTime, endTime);
        return rows.map(this.deserializeEvent);
    }
    getEventById(eventId) {
        const db = (0, database_1.getDatabase)();
        const row = db.prepare(`SELECT * FROM events WHERE id = ?`).get(eventId);
        return row ? this.deserializeEvent(row) : null;
    }
    replayEvents(aggregateId, untilVersion) {
        const events = this.getEventsByAggregate(aggregateId);
        if (untilVersion === undefined)
            return events;
        return events.filter(e => e.newVersion <= untilVersion);
    }
    deserializeEvent(row) {
        return {
            id: row.id,
            eventType: row.event_type,
            aggregateId: row.aggregate_id,
            aggregateType: row.aggregate_type,
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
class VersionConflictError extends Error {
    aggregateId;
    expectedVersion;
    actualVersion;
    constructor(aggregateId, expectedVersion, actualVersion) {
        super(`Version conflict for aggregate ${aggregateId}: expected ${expectedVersion}, got ${actualVersion}`);
        this.name = 'VersionConflictError';
        this.aggregateId = aggregateId;
        this.expectedVersion = expectedVersion;
        this.actualVersion = actualVersion;
    }
}
exports.VersionConflictError = VersionConflictError;
exports.eventStore = new EventStore();
