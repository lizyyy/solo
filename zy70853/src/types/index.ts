export enum RecordSource {
  PASSENGER = 'passenger',
  DRIVER = 'driver',
  WAREHOUSE = 'warehouse'
}

export enum MatchStatus {
  NORMAL = 'normal',
  PENDING = 'pending',
  FAILED = 'failed'
}

export enum FailReason {
  DUPLICATE_BATCH = 'duplicate_batch',
  SAME_NAME_ITEM = 'same_name_item',
  OVERDUE = 'overdue',
  INCOMPLETE_INFO = 'incomplete_info',
  MISMATCH = 'mismatch',
  SENSITIVE_INFO = 'sensitive_info'
}

export interface LostItemBase {
  id: string;
  itemName: string;
  description: string;
  date: string;
  routeId?: string;
  shiftId?: string;
  source: RecordSource;
}

export interface PassengerRecord extends LostItemBase {
  source: RecordSource.PASSENGER;
  passengerName: string;
  passengerPhone: string;
  passengerId?: string;
  claimDate?: string;
}

export interface DriverRecord extends LostItemBase {
  source: RecordSource.DRIVER;
  driverName: string;
  driverId: string;
  busNumber: string;
  handoverDate: string;
}

export interface WarehouseRecord extends LostItemBase {
  source: RecordSource.WAREHOUSE;
  storageLocation: string;
  storageDate: string;
  operator: string;
}

export type LostItemRecord = PassengerRecord | DriverRecord | WarehouseRecord;

export interface RouteShift {
  routeId: string;
  routeName: string;
  shiftId: string;
  shiftTime: string;
  driverId?: string;
  busNumber?: string;
}

export interface ImageIndex {
  itemId: string;
  imagePath: string;
  uploadDate: string;
  source: RecordSource;
}

export interface MatchResult {
  matchId: string;
  passengerRecord?: PassengerRecord;
  driverRecord?: DriverRecord;
  warehouseRecord?: WarehouseRecord;
  status: MatchStatus;
  confidence: number;
  notes: string[];
}

export interface FailedRecord {
  originalData: Record<string, any>;
  failReason: FailReason;
  failDescription: string;
  suggestion: string;
  source: RecordSource;
}

export interface ProcessResult {
  batchId: string;
  processDate: string;
  normalItems: MatchResult[];
  pendingItems: MatchResult[];
  failedItems: FailedRecord[];
  statistics: {
    total: number;
    normal: number;
    pending: number;
    failed: number;
  };
}

export interface BatchInfo {
  batchId: string;
  uploadDate: string;
  fileHashes: string[];
  processed: boolean;
}
