import { v4 as uuidv4 } from 'uuid';
import { Event, SyncState } from '../types';
import { getDatabase, executeTransaction } from '../database';
import { eventStore } from '../event-store';
import { cacheService } from './cache-service';

class SyncService {
  private syncLock: Map<string, boolean> = new Map();

  async sync(
    clientId: string,
    localEvents: Event[],
    lastKnownServerVersion: number
  ): Promise<{
    success: boolean;
    eventsToApply: Event[];
    conflicts: Array<{ localEvent: Event; serverEvent: Event }>;
    newServerVersion: number;
  }> {
    if (this.syncLock.get(clientId)) {
      throw new Error('Sync already in progress for this client');
    }

    this.syncLock.set(clientId, true);

    try {
      return await executeTransaction(async () => {
        await eventStore.appendEvent(
          'sync-' + clientId,
          'system',
          'SYNC_STARTED',
          { clientId, localEventsCount: localEvents.length },
          'system',
          clientId,
          0
        );

        const state = this.getSyncState();
        let conflicts: Array<{ localEvent: Event; serverEvent: Event }> = [];
        let eventsToApply: Event[] = [];

        for (const localEvent of localEvents) {
          const existingEvents = eventStore.getEventsByAggregate(localEvent.aggregateId);
          const serverVersion = existingEvents.length > 0 
            ? existingEvents[existingEvents.length - 1].newVersion 
            : 0;

          if (localEvent.previousVersion !== serverVersion && serverVersion > 0) {
            const latestServerEvent = existingEvents[existingEvents.length - 1];
            conflicts.push({ localEvent, serverEvent: latestServerEvent });
          } else {
            await this.applyRemoteEvent(localEvent);
          }
        }

        const allServerEvents = await this.getEventsSinceVersion(lastKnownServerVersion);
        eventsToApply = allServerEvents.filter(
          e => !localEvents.some(le => le.id === e.id)
        );

        this.updateSyncState({
          ...state,
          lastSyncedAt: Date.now(),
          serverVersion: this.getLatestVersion(),
          localVersion: this.getLatestVersion(),
          syncStatus: 'idle',
          pendingEvents: [],
        });

        await eventStore.appendEvent(
          'sync-' + clientId,
          'system',
          'SYNC_COMPLETED',
          { clientId, appliedCount: eventsToApply.length, conflictCount: conflicts.length },
          'system',
          clientId,
          0
        );

        await cacheService.invalidatePattern('bills');
        await cacheService.invalidatePattern('groups');

        return {
          success: conflicts.length === 0,
          eventsToApply,
          conflicts,
          newServerVersion: this.getLatestVersion(),
        };
      });
    } catch (error) {
      await eventStore.appendEvent(
        'sync-' + clientId,
        'system',
        'SYNC_FAILED',
        { clientId, error: (error as Error).message },
        'system',
        clientId,
        0
      );

      throw error;
    } finally {
      this.syncLock.delete(clientId);
    }
  }

  private async applyRemoteEvent(event: Event): Promise<void> {
    const db = getDatabase();
    
    const existing = db.prepare('SELECT id FROM events WHERE id = ?').get(event.id);
    if (existing) return;

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

  private async getEventsSinceVersion(version: number): Promise<Event[]> {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM events 
      WHERE new_version > ? 
      ORDER BY timestamp ASC
    `).all(version) as any[];

    return rows.map((row: any) => ({
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

  private getLatestVersion(): number {
    const db = getDatabase();
    const row = db.prepare('SELECT MAX(new_version) as version FROM events').get() as { version: number | null } | undefined;
    return row?.version || 0;
  }

  getSyncState(): SyncState {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM sync_state WHERE id = ?').get('main') as any | undefined;
    
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
      syncStatus: row.sync_status as SyncState['syncStatus'],
      serverVersion: row.server_version,
      localVersion: row.local_version,
    };
  }

  private updateSyncState(state: SyncState): void {
    const db = getDatabase();
    db.prepare(`
      UPDATE sync_state SET
        last_synced_at = ?,
        pending_events = ?,
        sync_status = ?,
        server_version = ?,
        local_version = ?
      WHERE id = 'main'
    `).run(
      state.lastSyncedAt,
      JSON.stringify(state.pendingEvents),
      state.syncStatus,
      state.serverVersion,
      state.localVersion
    );
  }

  async queueForSync(event: Event): Promise<void> {
    const state = this.getSyncState();
    state.pendingEvents.push(event.id);
    this.updateSyncState(state);
  }

  async replayEvents(aggregateId: string, targetVersion: number): Promise<boolean> {
    try {
      const events = eventStore.replayEvents(aggregateId, targetVersion);
      
      await eventStore.appendEvent(
        aggregateId,
        'system',
        'CACHE_INVALIDATED',
        { aggregateId, targetVersion },
        'system',
        'replay',
        0
      );

      const db = getDatabase();
      const existingRow = db.prepare('SELECT * FROM bills WHERE id = ?').get(aggregateId);
      
      if (existingRow) {
        let billState: any = null;
        for (const event of events) {
          if (event.eventType === 'BILL_CREATED') {
            billState = (event.payload as any).bill;
          } else if (event.eventType === 'BILL_UPDATED') {
            billState = { ...billState, ...(event.payload as any).updates };
          }
        }

        if (billState) {
          db.prepare(`
            UPDATE bills SET
              title = ?, description = ?, amount = ?, currency = ?,
              updated_at = ?, version = ?, participants = ?, tags = ?
            WHERE id = ?
          `).run(
            billState.title,
            billState.description || null,
            billState.amount,
            billState.currency,
            Date.now(),
            targetVersion,
            JSON.stringify(billState.participants),
            billState.tags ? JSON.stringify(billState.tags) : null,
            aggregateId
          );
        }
      }

      await cacheService.invalidate(aggregateId);
      return true;
    } catch (error) {
      await eventStore.appendEvent(
        aggregateId,
        'system',
        'TRANSACTION_ROLLBACK',
        { aggregateId, targetVersion, error: (error as Error).message },
        'system',
        'replay',
        0
      );
      throw error;
    }
  }
}

export const syncService = new SyncService();
