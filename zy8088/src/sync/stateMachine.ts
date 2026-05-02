import { SyncState, WorkOrder, SyncQueueItem, ConflictRecord } from '../types';
import * as server from '../server/mockServer';
import * as storage from '../storage/indexedDB';

type SyncListener = (state: SyncState, data?: unknown) => void;

class SyncStateMachine {
  private state: SyncState = 'IDLE';
  private listeners: Set<SyncListener> = new Set();

  getState(): SyncState {
    return this.state;
  }

  private setState(newState: SyncState): void {
    this.state = newState;
    this.notifyListeners();
  }

  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.state));
  }

  async sync(): Promise<{ success: boolean; conflicts: ConflictRecord[] }> {
    if (this.state === 'SYNCING') {
      return { success: false, conflicts: [] };
    }

    this.setState('SYNCING');

    try {
      const serverConfig = server.getServerConfig();

      if (!serverConfig.isOnline) {
        this.setState('OFFLINE');
        return { success: false, conflicts: [] };
      }

      if (!serverConfig.isOpen) {
        this.setState('ERROR');
        return { success: false, conflicts: [] };
      }

      const queue = await storage.getPendingSyncItems();
      const conflicts: ConflictRecord[] = [];

      for (const item of queue) {
        const result = await this.processQueueItem(item);
        if (result.conflict) {
          conflicts.push(result.conflict);
        }
      }

      if (conflicts.length > 0) {
        this.setState('CONFLICT');
      } else {
        this.setState('IDLE');
      }

      await this.refreshLocalData();

      return { success: true, conflicts };
    } catch (error) {
      this.setState('ERROR');
      return { success: false, conflicts: [] };
    }
  }

  private async processQueueItem(item: SyncQueueItem): Promise<{ success: boolean; conflict?: ConflictRecord }> {
    const updatedItem: SyncQueueItem = { ...item, status: 'syncing' };
    await storage.updateSyncQueueItem(updatedItem);

    try {
      if (item.operation === 'update') {
        const remote = await server.fetchWorkOrder(item.workOrderId);

        if (!remote) {
          updatedItem.status = 'failed';
          await storage.updateSyncQueueItem(updatedItem);
          return { success: false };
        }

        const local = await storage.getWorkOrderLocal(item.workOrderId);

        if (!local) {
          updatedItem.status = 'failed';
          await storage.updateSyncQueueItem(updatedItem);
          return { success: false };
        }

        if (remote.version > local.version && local.updatedBy === 'local') {
          const conflict: ConflictRecord = {
            workOrderId: item.workOrderId,
            localVersion: local,
            remoteVersion: remote,
            timestamp: new Date().toISOString()
          };

          await storage.saveConflict(conflict);
          updatedItem.status = 'conflict';
          await storage.updateSyncQueueItem(updatedItem);

          return { success: false, conflict };
        }

        const mergedPayload = this.mergeUpdates(local, item.payload);
        const updated = await server.updateWorkOrder(
          item.workOrderId,
          mergedPayload,
          remote.version
        );

        await storage.saveWorkOrderLocal({ ...updated, updatedBy: 'local' });
        await storage.removeSyncQueueItem(item.id);

        return { success: true };
      }

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage.includes('Version conflict') || errorMessage.includes('Server closed')) {
        updatedItem.retryCount++;

        if (updatedItem.retryCount >= 3) {
          updatedItem.status = 'failed';
        } else {
          updatedItem.status = 'pending';
        }
      } else {
        updatedItem.status = 'failed';
      }

      await storage.updateSyncQueueItem(updatedItem);
      return { success: false };
    }
  }

  private mergeUpdates(local: WorkOrder, payload: Partial<WorkOrder>): Partial<WorkOrder> {
    const merged: Partial<WorkOrder> = { ...payload };

    if (payload.photos) {
      const localPhotoMap = new Map(local.photos.map(p => [p.id, p]));
      merged.photos = payload.photos.map(p => {
        const existing = localPhotoMap.get(p.id);
        if (existing && new Date(existing.updatedAt) > new Date(p.updatedAt)) {
          return existing;
        }
        return p;
      });
    }

    return merged;
  }

  async refreshLocalData(): Promise<void> {
    try {
      const serverConfig = server.getServerConfig();

      if (!serverConfig.isOnline || !serverConfig.isOpen) {
        return;
      }

      const remoteOrders = await server.fetchWorkOrders();

      for (const remote of remoteOrders) {
        const local = await storage.getWorkOrderLocal(remote.id);

        if (!local || remote.version > local.version) {
          await storage.saveWorkOrderLocal({ ...remote, updatedBy: 'remote' });
        }
      }
    } catch {
      // Silently fail on refresh
    }
  }

  async handleLocalUpdate(workOrder: WorkOrder): Promise<void> {
    const localWithUpdate: WorkOrder = {
      ...workOrder,
      updatedBy: 'local',
      updatedAt: new Date().toISOString()
    };

    await storage.saveWorkOrderLocal(localWithUpdate);

    await storage.addToSyncQueue(workOrder.id, 'update', {
      status: workOrder.status,
      notes: workOrder.notes,
      photos: workOrder.photos
    });
  }

  async resolveConflict(
    workOrderId: string,
    resolution: 'local' | 'remote' | 'merged',
    mergedData?: WorkOrder
  ): Promise<void> {
    const conflict = await storage.getConflict(workOrderId);

    if (!conflict) {
      return;
    }

    let resolvedVersion: WorkOrder;

    switch (resolution) {
      case 'local':
        resolvedVersion = conflict.localVersion;
        break;
      case 'remote':
        resolvedVersion = conflict.remoteVersion;
        break;
      case 'merged':
        if (!mergedData) {
          throw new Error('Merged data required for merged resolution');
        }
        resolvedVersion = mergedData;
        break;
    }

    resolvedVersion = {
      ...resolvedVersion,
      version: Math.max(conflict.localVersion.version, conflict.remoteVersion.version) + 1,
      updatedAt: new Date().toISOString(),
      updatedBy: 'local'
    };

    await storage.saveWorkOrderLocal(resolvedVersion);
    await storage.resolveConflict(workOrderId);

    const queueItems = await storage.getSyncQueueByWorkOrder(workOrderId);
    for (const item of queueItems) {
      if (item.status === 'conflict') {
        await storage.removeSyncQueueItem(item.id);
      }
    }

    const remainingConflicts = await storage.getAllConflicts();

    if (remainingConflicts.length === 0) {
      this.setState('IDLE');
    }
  }

  async retryFailedItems(): Promise<void> {
    const queue = await storage.getSyncQueue();
    const failedItems = queue.filter(item => item.status === 'failed');

    for (const item of failedItems) {
      const updated: SyncQueueItem = {
        ...item,
        status: 'pending',
        retryCount: 0
      };
      await storage.updateSyncQueueItem(updated);
    }

    await this.sync();
  }

  async clearAllPending(): Promise<void> {
    const queue = await storage.getSyncQueue();
    for (const item of queue) {
      if (item.status === 'pending' || item.status === 'failed') {
        await storage.removeSyncQueueItem(item.id);
      }
    }
    this.setState('IDLE');
  }

  setOffline(): void {
    this.setState('OFFLINE');
  }

  setOnline(): void {
    if (this.state === 'OFFLINE') {
      this.setState('IDLE');
    }
  }
}

export const syncStateMachine = new SyncStateMachine();
