export interface Photo {
  id: string;
  url: string;
  caption: string;
  updatedAt: string;
}

export interface WorkOrder {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'closed';
  photos: Photo[];
  notes: string;
  version: number;
  updatedAt: string;
  updatedBy: 'local' | 'remote';
}

export interface SyncQueueItem {
  id: string;
  workOrderId: string;
  operation: 'create' | 'update';
  payload: Partial<WorkOrder>;
  timestamp: string;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed' | 'conflict';
  operationSignature: string;
}

export interface ConflictRecord {
  workOrderId: string;
  localVersion: WorkOrder;
  remoteVersion: WorkOrder;
  resolvedVersion?: WorkOrder;
  resolution?: 'local' | 'remote' | 'merged';
  timestamp: string;
}

export type SyncState = 'IDLE' | 'SYNCING' | 'OFFLINE' | 'CONFLICT' | 'ERROR';

export interface ServerConfig {
  isOnline: boolean;
  isOpen: boolean;
  delay: number;
}
