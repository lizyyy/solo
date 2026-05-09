export interface Event {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  timestamp: string;
  source: string;
  message: string;
  data?: Record<string, any>;
}

export interface ConnectionState {
  id: string;
  status: string;
  createdAt: string;
  lastActiveAt: string;
  messageCount: number;
  reconnectCount: number;
}

export interface MessageState {
  id: string;
  content: string;
  sequence: number;
  status: string;
  sentAt: string;
  receivedAt: string;
  delayMs: number;
}

export interface GoroutineState {
  id: number;
  name: string;
  createdAt: string;
  status: string;
  isLeaked: boolean;
  expectedEnd?: string;
}

export interface DbLockState {
  resource: string;
  holderId: string;
  acquiredAt: string;
  waiters: string[];
}

export interface CacheState {
  key: string;
  value: any;
  version: number;
  lastUpdated: string;
  isDirty: boolean;
  ttl: number;
}

export interface ConfigState {
  key: string;
  value: any;
  source: string;
  lastUpdated: string;
  expectedValue?: any;
  hasDrift: boolean;
}

export interface SystemMetrics {
  activeConnections: number;
  connectionPoolSize: number;
  connectionPoolUsage: number;
  messageQueueSize: number;
  messageProcessed: number;
  activeGoroutines: number;
  leakedGoroutines: number;
  dbLockWaitTimeMs: number;
  cacheHitRate: number;
  configDriftCount: number;
}

export interface SystemState {
  timestamp: string;
  connections: ConnectionState[];
  messages: MessageState[];
  goroutines: GoroutineState[];
  dbLocks: DbLockState[];
  cache: CacheState[];
  config: ConfigState[];
  metrics: SystemMetrics;
}

export interface WSMessage {
  type: 'event' | 'state';
  event?: Event;
  state?: SystemState;
}
