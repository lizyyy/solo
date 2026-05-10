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
  created_at: string;
  last_active_at: string;
  message_count: number;
  reconnect_count: number;
}

export interface MessageState {
  id: string;
  content: string;
  sequence: number;
  status: string;
  sent_at: string;
  received_at: string;
  delay_ms: number;
}

export interface GoroutineState {
  id: number;
  name: string;
  created_at: string;
  status: string;
  is_leaked: boolean;
  expected_end?: string;
}

export interface DbLockState {
  resource: string;
  holder_id: string;
  acquired_at: string;
  waiters: string[];
}

export interface CacheState {
  key: string;
  value: any;
  version: number;
  last_updated: string;
  is_dirty: boolean;
  ttl: number;
}

export interface ConfigState {
  key: string;
  value: any;
  source: string;
  last_updated: string;
  expected_value?: any;
  has_drift: boolean;
}

export interface SystemMetrics {
  active_connections: number;
  connection_pool_size: number;
  connection_pool_usage: number;
  message_queue_size: number;
  message_processed: number;
  active_goroutines: number;
  leaked_goroutines: number;
  db_lock_wait_time_ms: number;
  cache_hit_rate: number;
  config_drift_count: number;
}

export interface SystemState {
  timestamp: string;
  connections: ConnectionState[];
  messages: MessageState[];
  goroutines: GoroutineState[];
  db_locks: DbLockState[];
  cache: CacheState[];
  config: ConfigState[];
  metrics: SystemMetrics;
}

export interface WSMessage {
  type: 'event' | 'state';
  event?: Event;
  state?: SystemState;
}

export interface PlaybackControl {
  is_playing: boolean;
  speed: number;
  current_idx: number;
  total_idx: number;
}
