export interface PurchaseContract {
  id: string;
  contractNo: string;
  supplier: string;
  copperGrade: string;
  quantity: number;
  price: number;
  deliveryDate: string;
  arrivalDate?: string;
  status: 'pending' | 'in_transit' | 'received';
  createdAt: string;
}

export interface InventoryLot {
  id: string;
  lotNo: string;
  contractId: string;
  quantity: number;
  warehouse: string;
  receiptDate: string;
  matchedPositionId?: string;
  matchStatus: 'unmatched' | 'matched' | 'mismatch';
  notes?: string;
  mismatchReason?: string;
}

export interface FuturesPosition {
  id: string;
  contractMonth: string;
  direction: 'long' | 'short';
  quantity: number;
  openPrice: number;
  currentPrice: number;
  openDate: string;
  deliveryMonth: string;
  isRollover: boolean;
  rolloverFromId?: string;
  status: 'open' | 'closed' | 'rolled';
  hedgedLotId?: string;
  pnl?: number;
}

export interface RolloverRecord {
  id: string;
  fromPositionId: string;
  toPositionId: string;
  rolloverDate: string;
  closePrice: number;
  openPrice: number;
  rolloverCost: number;
  quantity: number;
  reason: string;
  isComplete: boolean;
}

export interface BasisRecord {
  id: string;
  positionId: string;
  basisDate: string;
  spotPrice: number;
  futuresPrice: number;
  basisValue: number;
  isLocked: boolean;
}

export interface ExposureConfig {
  id: string;
  name: string;
  calculationMethod: 'gross' | 'net' | 'weighted';
  includeUnmatched: boolean;
  dateRange: { start: string; end: string };
  deliveryMonths: string[];
  hedgingRatio: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExposureResult {
  configId: string;
  calculationDate: string;
  totalSpotExposure: number;
  totalFuturesHedge: number;
  netExposure: number;
  hedgingRatio: number;
  basisRisk: number;
  byDeliveryMonth: Record<string, { spot: number; futures: number; net: number }>;
  unmatchedLots: string[];
  warnings: WarningItem[];
}

export interface WarningItem {
  id: string;
  type: 'mismatch' | 'rollover' | 'basis_duplicate' | 'other';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  suggestion: string;
  relatedEntityId?: string;
  isRead: boolean;
}

export interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  fieldName: string;
  oldValue: any;
  newValue: any;
  reason: string;
  operator: string;
  timestamp: string;
}

export type DataType = 'contracts' | 'lots' | 'positions' | 'basis' | 'rollovers';

export interface ImportResult {
  type: DataType;
  success: number;
  failed: number;
  errors: string[];
  warnings: string[];
}
