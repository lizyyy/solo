export enum ProcessingStatus {
  NORMAL = 'normal',
  PENDING_SUPPLEMENT = 'pending_supplement',
  BLOCKED = 'blocked'
}

export enum LinenType {
  BED_SHEET = 'bed_sheet',
  PILLOWCASE = 'pillowcase',
  TOWEL = 'towel',
  BATH_TOWEL = 'bath_towel',
  BEDSPREAD = 'bedspread',
  BATHROBE = 'bathrobe'
}

export enum RoomType {
  STANDARD = 'standard',
  DELUXE = 'deluxe',
  SUITE = 'suite',
  PRESIDENTIAL = 'presidential'
}

export interface LinenItem {
  linenType: LinenType;
  sendQuantity: number;
  returnQuantity: number;
  damagedQuantity: number;
  damageCompensation: number;
}

export interface RoomStandard {
  roomType: RoomType;
  roomCount: number;
  linenItems: LinenItem[];
}

export interface BillingItem {
  linenType: LinenType;
  billedQuantity: number;
  billedAmount: number;
}

export interface ReconciliationRecord {
  id: string;
  batchId: string;
  hotelId: string;
  hotelName: string;
  submitDate: string;
  washDate: string;
  returnDate: string;
  handler: string;
  roomStandards: RoomStandard[];
  billingItems: BillingItem[];
  processingStatus: ProcessingStatus;
  statusReason: string;
  errorDetails: ErrorDetail[];
  createdAt: string;
  updatedAt: string;
}

export interface ErrorDetail {
  field: string;
  rowIndex?: number;
  message: string;
  errorCode: string;
}

export interface ReconciliationSubmitRequest {
  batchId: string;
  hotelId: string;
  hotelName: string;
  submitDate: string;
  washDate: string;
  returnDate: string;
  handler: string;
  roomStandards: RoomStandard[];
  billingItems: BillingItem[];
}

export interface ReconciliationResult {
  success: boolean;
  batchId: string;
  processingStatus: ProcessingStatus;
  statusReason: string;
  recordId?: string;
  errorDetails?: ErrorDetail[];
  isDuplicate?: boolean;
}

export interface StatisticsResult {
  totalSendQuantity: number;
  totalReturnQuantity: number;
  totalDamagedQuantity: number;
  totalDamageCompensation: number;
  totalBilledQuantity: number;
  totalBilledAmount: number;
  quantityDiscrepancy: number;
  amountDiscrepancy: number;
  byRoomType: {
    roomType: RoomType;
    sendQuantity: number;
    returnQuantity: number;
    damagedQuantity: number;
    damageCompensation: number;
  }[];
  byLinenType: {
    linenType: LinenType;
    sendQuantity: number;
    returnQuantity: number;
    damagedQuantity: number;
    damageCompensation: number;
    billedQuantity: number;
    billedAmount: number;
    discrepancy: number;
  }[];
}

export interface ExportRecord {
  batchId: string;
  hotelName: string;
  submitDate: string;
  handler: string;
  linenType: string;
  roomType: string;
  sendQuantity: number;
  returnQuantity: number;
  damagedQuantity: number;
  damageCompensation: number;
  billedQuantity: number;
  billedAmount: number;
  discrepancy: number;
  processingStatus: string;
  statusReason: string;
}
