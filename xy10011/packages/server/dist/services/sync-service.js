"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncService = void 0;
const uuid_1 = require("uuid");
const database_1 = require("../database");
const event_store_1 = require("../event-store");
const cache_service_1 = require("./cache-service");
class SyncService {
    syncLock = new Map();
    async sync(clientId, localEvents, lastKnownServerVersion) {
        if (this.syncLock.get(clientId)) {
            throw new Error('Sync already in progress for this client');
        }
        this.syncLock.set(clientId, true);
        try {
            this.appendSystemEvent('sync-' + clientId, 'SYNC_STARTED', { clientId, localEventsCount: localEvents.length }, clientId);
            const state = this.getSyncState();
            let conflicts = [];
            let eventsToApply = [];
            for (const localEvent of localEvents) {
                const existingEvents = event_store_1.eventStore.getEventsByAggregate(localEvent.aggregateId);
                const serverVersion = existingEvents.length > 0
                    ? existingEvents[existingEvents.length - 1].newVersion
                    : 0;
                if (localEvent.previousVersion !== serverVersion && serverVersion > 0) {
                    const latestServerEvent = existingEvents[existingEvents.length - 1];
                    conflicts.push({ localEvent, serverEvent: latestServerEvent });
                }
                else {
                    this.applyRemoteEvent(localEvent);
                }
            }
            const allServerEvents = this.getEventsSinceVersion(lastKnownServerVersion);
            eventsToApply = allServerEvents.filter(e => !localEvents.some(le => le.id === e.id));
            this.updateSyncState({
                ...state,
                lastSyncedAt: Date.now(),
                serverVersion: this.getLatestVersion(),
                localVersion: this.getLatestVersion(),
                syncStatus: 'idle',
                pendingEvents: [],
            });
            this.appendSystemEvent('sync-' + clientId, 'SYNC_COMPLETED', { clientId, appliedCount: eventsToApply.length, conflictCount: conflicts.length }, clientId);
            cache_service_1.cacheService.invalidatePattern('bills');
            cache_service_1.cacheService.invalidatePattern('groups');
            return {
                success: conflicts.length === 0,
                eventsToApply,
                conflicts,
                newServerVersion: this.getLatestVersion(),
            };
        }
        catch (error) {
            this.appendSystemEvent('sync-' + clientId, 'SYNC_FAILED', { clientId, error: error.message }, clientId);
            throw error;
        }
        finally {
            this.syncLock.delete(clientId);
        }
    }
    appendSystemEvent(aggregateId, eventType, payload, clientId) {
        const db = (0, database_1.getDatabase)();
        const existingEvents = event_store_1.eventStore.getEventsByAggregate(aggregateId);
        const currentVersion = existingEvents.length > 0
            ? existingEvents[existingEvents.length - 1].newVersion
            : 0;
        const sequence = existingEvents.length + 1;
        const event = {
            id: (0, uuid_1.v4)(),
            eventType,
            aggregateId,
            aggregateType: 'system',
            payload,
            previousVersion: currentVersion,
            newVersion: currentVersion + 1,
            userId: 'system',
            timestamp: Date.now(),
            clientId,
            sequence,
        };
        db.prepare(`
      INSERT INTO events (
        id, event_type, aggregate_id, aggregate_type, payload,
        previous_version, new_version, user_id, timestamp,
        client_id, ip_address, user_agent, correlation_id, sequence
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(event.id, event.eventType, event.aggregateId, event.aggregateType, JSON.stringify(event.payload), event.previousVersion, event.newVersion, event.userId, event.timestamp, event.clientId, null, null, null, event.sequence);
    }
    applyRemoteEvent(event) {
        const db = (0, database_1.getDatabase)();
        const existing = db.prepare('SELECT id FROM events WHERE id = ?').get(event.id);
        if (existing)
            return;
        db.prepare(`
      INSERT INTO events (
        id, event_type, aggregate_id, aggregate_type, payload,
        previous_version, new_version, user_id, timestamp,
        client_id, ip_address, user_agent, correlation_id, sequence
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(event.id, event.eventType, event.aggregateId, event.aggregateType, JSON.stringify(event.payload), event.previousVersion, event.newVersion, event.userId, event.timestamp, event.clientId, event.ipAddress || null, event.userAgent || null, event.correlationId || null, event.sequence);
    }
    getEventsSinceVersion(version) {
        const db = (0, database_1.getDatabase)();
        const rows = db.prepare(`
      SELECT * FROM events 
      WHERE new_version > ? 
      ORDER BY timestamp ASC
    `).all(version);
        return rows.map((row) => ({
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
        }));
    }
    getLatestVersion() {
        const db = (0, database_1.getDatabase)();
        const row = db.prepare('SELECT MAX(new_version) as version FROM events').get();
        return row?.version || 0;
    }
    getSyncState() {
        const db = (0, database_1.getDatabase)();
        const row = db.prepare('SELECT * FROM sync_state WHERE id = ?').get('main');
        if (!row) {
            return {
                lastSyncedAt: 0,
                pendingEvents: [],
                syncStatus: 'idle',
                serverVersion: 0,
                localVersion: 0,
            };
        }
        return {
            lastSyncedAt: row.last_synced_at,
            pendingEvents: JSON.parse(row.pending_events),
            syncStatus: row.sync_status,
            serverVersion: row.server_version,
            localVersion: row.local_version,
        };
    }
    updateSyncState(state) {
        const db = (0, database_1.getDatabase)();
        const existing = db.prepare('SELECT id FROM sync_state WHERE id = ?').get('main');
        if (existing) {
            db.prepare(`
        UPDATE sync_state SET
          last_synced_at = ?,
          pending_events = ?,
          sync_status = ?,
          server_version = ?,
          local_version = ?
        WHERE id = 'main'
      `).run(state.lastSyncedAt, JSON.stringify(state.pendingEvents), state.syncStatus, state.serverVersion, state.localVersion);
        }
        else {
            db.prepare(`
        INSERT INTO sync_state (
          id, last_synced_at, pending_events, sync_status, server_version, local_version
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run('main', state.lastSyncedAt, JSON.stringify(state.pendingEvents), state.syncStatus, state.serverVersion, state.localVersion);
        }
    }
    async queueForSync(event) {
        const state = this.getSyncState();
        state.pendingEvents.push(event.id);
        this.updateSyncState(state);
    }
    async replayEvents(aggregateId, targetVersion) {
        try {
            const events = event_store_1.eventStore.replayEvents(aggregateId, targetVersion);
            const currentEvents = event_store_1.eventStore.getEventsByAggregate(aggregateId);
            const currentVersion = currentEvents.length > 0
                ? currentEvents[currentEvents.length - 1].newVersion
                : 0;
            this.appendSystemEvent(aggregateId, 'CACHE_INVALIDATED', { aggregateId, targetVersion }, 'replay');
            const db = (0, database_1.getDatabase)();
            const existingRow = db.prepare('SELECT * FROM bills WHERE id = ?').get(aggregateId);
            if (existingRow) {
                let billState = null;
                for (const event of events) {
                    if (event.eventType === 'BILL_CREATED') {
                        billState = event.payload.bill;
                    }
                    else if (event.eventType === 'BILL_UPDATED') {
                        billState = { ...billState, ...event.payload.updates };
                    }
                }
                if (billState) {
                    db.prepare(`
            UPDATE bills SET
              title = ?, description = ?, amount = ?, currency = ?,
              updated_at = ?, version = ?, participants = ?, tags = ?
            WHERE id = ?
          `).run(billState.title, billState.description || null, billState.amount, billState.currency, Date.now(), targetVersion, JSON.stringify(billState.participants), billState.tags ? JSON.stringify(billState.tags) : null, aggregateId);
                }
            }
            cache_service_1.cacheService.invalidate(aggregateId);
            return true;
        }
        catch (error) {
            this.appendSystemEvent(aggregateId, 'TRANSACTION_ROLLBACK', { aggregateId, targetVersion, error: error.message }, 'replay');
            throw error;
        }
    }
}
exports.syncService = new SyncService();
