export enum RecordSource {
  PASSENGER = 'passenger',
  DRIVER = 'driver',
  WAREHOUSE = 'warehouse'
}

export enum ItemStatus {
  PENDING = 'pending',
  MATCHED = 'matched',
  UNMATCHED = 'unmatched',
  REVIEWING = 'reviewing',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  RETURNED = 'returned',
  CLAIMED = 'claimed',
  OVERDUE = 'overdue'
}

export enum ReviewAction {
  APPROVE = 'approve',
  REJECT = 'reject',
  REQUEST_MORE_INFO = 'request_more_info',
  MANUAL_MATCH = 'manual_match',
  UNMATCH = 'unmatch'
}

export enum DifferenceType {
  SAME_NAME = 'same_name',
  OVERDUE = 'overdue',
  SENSITIVE_INFO = 'sensitive_info',
  DESCRIPTION_MISMATCH = 'description_mismatch',
  TIME_MISMATCH = 'time_mismatch',
  LOCATION_MISMATCH = 'location_mismatch',
  DUPLICATE = 'duplicate'
}

export interface PassengerLostItem {
  id: string;
  reportDate: string;
  reportTime: string;
  passengerName: string;
  passengerPhone: string;
  itemName: string;
  itemDescription: string;
  itemCategory: string;
  itemColor?: string;
  itemBrand?: string;
  routeNumber: string;
  busNumber?: string;
  lostDate: string;
  lostTime: string;
  lostLocation: string;
  destination?: string;
  seatLocation?: string;
  remarks?: string;
  source: RecordSource.PASSENGER;
}

export interface DriverTurnedInItem {
  id: string;
  turnInDate: string;
  turnInTime: string;
  driverName: string;
  driverId: string;
  routeNumber: string;
  busNumber: string;
  itemName: string;
  itemDescription: string;
  itemCategory: string;
  itemColor?: string;
  itemBrand?: string;
  foundDate: string;
  foundTime: string;
  foundLocation: string;
  bagNumber?: string;
  remarks?: string;
  imageIds: string[];
  source: RecordSource.DRIVER;
}

export interface WarehouseItem {
  id: string;
  receiptDate: string;
  receiptTime: string;
  warehouseStaff: string;
  itemName: string;
  itemDescription: string;
  itemCategory: string;
  itemColor?: string;
  itemBrand?: string;
  storageLocation: string;
  shelfNumber?: string;
  bagNumber?: string;
  driverTurnInId?: string;
  imageIds: string[];
  remarks?: string;
  source: RecordSource.WAREHOUSE;
}

export interface ImageIndex {
  id: string;
  itemId: string;
  fileName: string;
  filePath: string;
  uploadDate: string;
  uploader: string;
  thumbnailPath?: string;
}

export interface RouteSchedule {
  routeNumber: string;
  busNumber: string;
  driverName: string;
  driverId: string;
  date: string;
  startTime: string;
  endTime: string;
  stops: string[];
}

export type SourceItem = PassengerLostItem | DriverTurnedInItem | WarehouseItem;

export interface MatchCandidate {
  passengerItem?: PassengerLostItem;
  driverItem?: DriverTurnedInItem;
  warehouseItem?: WarehouseItem;
  matchScore: number;
  matchedFields: string[];
  differences: DifferenceType[];
  differenceExplanations: string[];
  isSameName: boolean;
  isOverdue: boolean;
  hasSensitiveInfo: boolean;
}

export interface MatchRecord {
  id: string;
  matchId: string;
  batchId: string;
  passengerItemId?: string;
  driverItemId?: string;
  warehouseItemId?: string;
  matchScore: number;
  status: ItemStatus;
  matchedFields: string[];
  differences: DifferenceType[];
  differenceExplanations: string[];
  isSameName: boolean;
  isOverdue: boolean;
  hasSensitiveInfo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewRecord {
  id: string;
  matchId: string;
  reviewer: string;
  reviewDate: string;
  reviewTime: string;
  action: ReviewAction;
  previousStatus: ItemStatus;
  newStatus: ItemStatus;
  reason: string;
  changes: {
    field: string;
    oldValue: string;
    newValue: string;
  }[];
}

export interface ReconciliationBatch {
  id: string;
  name: string;
  createdAt: string;
  createdBy: string;
  status: 'processing' | 'completed' | 'reviewing';
  passengerCount: number;
  driverCount: number;
  warehouseCount: number;
  matchedCount: number;
  unmatchedCount: number;
  reviewingCount: number;
  approvedCount: number;
  rejectedCount: number;
  overdueCount: number;
}

export interface ReportData {
  batchId: string;
  generatedAt: string;
  summary: {
    totalPassengerReports: number;
    totalDriverTurnIns: number;
    totalWarehouseReceipts: number;
    matched: number;
    unmatched: number;
    reviewing: number;
    approved: number;
    rejected: number;
    overdue: number;
    matchRate: number;
  };
  details: MatchRecord[];
  reviewHistory: ReviewRecord[];
  differenceBreakdown: {
    type: DifferenceType;
    count: number;
    description: string;
  }[];
}

export type ImportResult<T> = {
  success: boolean;
  data: T[];
  errors: string[];
  totalCount: number;
  validCount: number;
  invalidCount: number;
};
