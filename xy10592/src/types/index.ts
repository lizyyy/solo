export enum AssetCategory {
  FREEZER = 'FREEZER',
  CASH_REGISTER = 'CASH_REGISTER',
  COFFEE_MACHINE = 'COFFEE_MACHINE'
}

export enum AssetStatus {
  ACTIVE = 'ACTIVE',
  REPAIRING = 'REPAIRING',
  SCRAPPED = 'SCRAPPED'
}

export enum TransactionType {
  ACQUISITION = 'ACQUISITION',
  TRANSFER = 'TRANSFER',
  REPAIR = 'REPAIR',
  SCRAP = 'SCRAP',
  DEPRECIATION = 'DEPRECIATION',
  CORRECTION = 'CORRECTION'
}

export enum RepairType {
  ROUTINE = 'ROUTINE',
  CAPITALIZED = 'CAPITALIZED'
}

export interface Store {
  id: string;
  name: string;
  code: string;
}

export interface Asset {
  id: string;
  code: string;
  name: string;
  category: AssetCategory;
  description: string;
  currentStoreId: string;
  status: AssetStatus;
  originalCost: number;
  accumulatedDepreciation: number;
  netBookValue: number;
  usefulLifeMonths: number;
  remainingLifeMonths: number;
  residualValueRate: number;
  acquisitionDate: string;
  lastDepreciationDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AcquisitionRecord {
  id: string;
  assetId: string;
  storeId: string;
  acquisitionDate: string;
  cost: number;
  usefulLifeMonths: number;
  residualValueRate: number;
  supplier: string;
  invoiceNumber: string;
  createdBy: string;
  createdAt: string;
}

export interface TransferRecord {
  id: string;
  assetId: string;
  fromStoreId: string;
  toStoreId: string;
  transferDate: string;
  reason: string;
  transferor: string;
  transferee: string;
  approvedBy: string;
  createdBy: string;
  createdAt: string;
}

export interface RepairRecord {
  id: string;
  assetId: string;
  storeId: string;
  repairDate: string;
  repairType: RepairType;
  cost: number;
  description: string;
  vendor: string;
  extendedLifeMonths: number;
  createdBy: string;
  createdAt: string;
}

export interface ScrapRecord {
  id: string;
  assetId: string;
  storeId: string;
  scrapDate: string;
  reason: string;
  scrapValue: number;
  approvedBy: string;
  createdBy: string;
  createdAt: string;
}

export interface DepreciationPeriod {
  id: string;
  year: number;
  month: number;
  startDate: string;
  endDate: string;
  isClosed: boolean;
  closedBy: string | null;
  closedAt: string | null;
}

export interface DepreciationDetail {
  id: string;
  assetId: string;
  storeId: string;
  periodId: string;
  periodYear: number;
  periodMonth: number;
  depreciationAmount: number;
  accumulatedDepreciationBefore: number;
  accumulatedDepreciationAfter: number;
  netBookValueBefore: number;
  netBookValueAfter: number;
  calculationMethod: string;
  createdBy: string;
  createdAt: string;
}

export interface AssetHistory {
  id: string;
  assetId: string;
  transactionType: TransactionType;
  transactionId: string;
  fromStoreId: string | null;
  toStoreId: string | null;
  amount: number;
  description: string;
  operator: string;
  beforeState: string | null;
  afterState: string | null;
  createdAt: string;
}

export interface CorrectionRecord {
  id: string;
  assetId: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  reason: string;
  operator: string;
  createdAt: string;
}

export interface SystemState {
  initialized: boolean;
  initializedAt: string | null;
  lastCheckAt: string | null;
  dataDirectory: string;
  importVersion: number;
}

export interface ImportData {
  assets: Asset[];
  acquisitions: AcquisitionRecord[];
  transfers: TransferRecord[];
  repairs: RepairRecord[];
  scraps: ScrapRecord[];
  stores: Store[];
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export interface ValidationError {
  code: string;
  message: string;
  severity: 'error' | 'warning';
  assetId?: string;
  storeId?: string;
  recordId?: string;
}

export interface StoreReport {
  storeId: string;
  storeName: string;
  storeCode: string;
  totalAssets: number;
  totalOriginalCost: number;
  totalAccumulatedDepreciation: number;
  totalNetBookValue: number;
  assetBreakdown: {
    category: AssetCategory;
    count: number;
    originalCost: number;
    accumulatedDepreciation: number;
    netBookValue: number;
  }[];
  depreciationDetails: DepreciationDetail[];
  anomalies: Anomaly[];
}

export interface Anomaly {
  code: string;
  message: string;
  type: 'error' | 'warning' | 'info';
  assetId?: string;
  assetCode?: string;
  storeId?: string;
  details?: Record<string, unknown>;
}

export interface AssetDetailView {
  asset: Asset;
  history: AssetHistory[];
  corrections: CorrectionRecord[];
  depreciationHistory: DepreciationDetail[];
  currentStore: Store | null;
  relatedRecords: {
    acquisition: AcquisitionRecord | null;
    transfers: TransferRecord[];
    repairs: RepairRecord[];
    scrap: ScrapRecord | null;
  };
}
