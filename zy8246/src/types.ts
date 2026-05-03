export interface Room {
  roomNumber: string;
  checkoutTime: string;
  storeId: string;
  storeName: string;
}

export interface LinenTag {
  tagId: string;
  type: string;
  storeId: string;
  lastScan: string;
  scanLocation: string;
  soilLevel: string;
  status: string;
}

export interface BatchTag {
  tagId: string;
  scanTime: string;
}

export interface LaundryBatch {
  batchId: string;
  storeId: string;
  createdAt: string;
  sentAt: string | null;
  vendorId: string;
  status: string;
  expectedReturn: string | null;
  returnedAt: string | null;
  tags: BatchTag[];
}

export interface LaundryBatches {
  batches: LaundryBatch[];
}

export interface VendorRule {
  vendorId: string;
  vendorName: string;
  soilLevel: string;
  linenType: string;
  treatmentType: string;
  washTemperature: number;
  dryTemperature: number;
  specialInstructions: string;
}

export enum IssueSeverity {
  ERROR = 'ERROR',
  WARNING = 'WARNING',
  INFO = 'INFO'
}

export enum IssueType {
  DUPLICATE_TAG_IN_BATCH = 'DUPLICATE_TAG_IN_BATCH',
  CROSS_STORE_MIX = 'CROSS_STORE_MIX',
  OVERDUE_RETURN = 'OVERDUE_RETURN',
  SOIL_LEVEL_RULE_MISMATCH = 'SOIL_LEVEL_RULE_MISMATCH',
  MISSING_RFID_SCAN = 'MISSING_RFID_SCAN',
  CROSS_MIDNIGHT_CHECKOUT = 'CROSS_MIDNIGHT_CHECKOUT',
  UNKNOWN_SOIL_LEVEL = 'UNKNOWN_SOIL_LEVEL',
  BATCH_NOT_SENT = 'BATCH_NOT_SENT'
}

export interface Issue {
  id: string;
  type: IssueType;
  severity: IssueSeverity;
  title: string;
  description: string;
  affectedEntities: string[];
  storeId: string;
  timestamp: string;
  details: Record<string, unknown>;
}

export interface ValidationResult {
  isValid: boolean;
  issues: Issue[];
  warnings: Issue[];
}

export interface ReviewSummary {
  totalRooms: number;
  totalTags: number;
  totalBatches: number;
  crossMidnightCheckouts: number;
  issuesByType: Record<IssueType, number>;
  issuesByStore: Record<string, number>;
  overdueBatches: number;
  duplicateTags: number;
  crossStoreMixes: number;
}

export interface DataContext {
  rooms: Room[];
  linenTags: LinenTag[];
  laundryBatches: LaundryBatch[];
  vendorRules: VendorRule[];
}