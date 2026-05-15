export interface BusReservation {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  busRoute: string;
  busStop: string;
  date: string;
  timeSlot: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  source: string;
  version: number;
}

export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
  hitCount: number;
  lastHitAt: number;
}

export interface CacheStats {
  totalOperations: number;
  hits: number;
  misses: number;
  hitRate: number;
  concurrentConflicts: number;
  overwrittenKeys: string[];
}

export interface AnalysisResult {
  stats: CacheStats;
  reservations: BusReservation[];
  anomalies: Anomaly[];
  rawData: BusReservation[];
}

export interface Anomaly {
  type: 'concurrent_overwrite' | 'inconsistent_state' | 'missing_field';
  reservationId: string;
  description: string;
  beforeValue?: any;
  afterValue?: any;
  affectedFields: string[];
  timestamp: string;
}

export interface PreviewResult {
  action: string;
  count: number;
  affectedIds: string[];
  sampleItems: BusReservation[];
}

export interface RollbackPlan {
  rollbackId: string;
  itemsToRestore: BusReservation[];
  backupSnapshot: BusReservation[];
  createdAt: string;
}
