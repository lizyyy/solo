export type RecordType = 'purchase' | 'sale' | 'loss' | 'inventory';

export interface BaseRecord {
  id: string;
  type: RecordType;
  timestamp: number;
}

export interface Product {
  code: string;
  name: string;
  unit: string;
  basePrice: number;
}

export interface PurchaseRecord extends BaseRecord {
  type: 'purchase';
  productCode: string;
  batchId: string;
  quantity: number;
  unitCost: number;
  expirationDate?: string;
  supplier?: string;
}

export interface SaleRecord extends BaseRecord {
  type: 'sale';
  productCode: string;
  batchId: string;
  quantity: number;
  unitPrice: number;
  discountRate?: number;
  originalPrice?: number;
  saleTime: number;
}

export interface LossRecord extends BaseRecord {
  type: 'loss';
  productCode: string;
  batchId: string;
  quantity: number;
  lossReason: string;
  lossTime: number;
  reporter?: string;
}

export interface InventoryRecord extends BaseRecord {
  type: 'inventory';
  productCode: string;
  batchId: string;
  countedQuantity: number;
  inventoryDate: number;
  operator?: string;
}

export type DataRecord = PurchaseRecord | SaleRecord | LossRecord | InventoryRecord;

export interface BatchInventory {
  productCode: string;
  batchId: string;
  purchasedQuantity: number;
  soldQuantity: number;
  lossQuantity: number;
  expectedInventory: number;
  actualInventory: number;
  discrepancy: number;
}

export interface BatchCalculation {
  productCode: string;
  productName: string;
  batchId: string;
  totalCost: number;
  totalRevenue: number;
  grossProfit: number;
  grossProfitMargin: number;
  lossQuantity: number;
  lossCost: number;
  lossRate: number;
  expectedInventory: number;
  actualInventory: number;
  inventoryDiscrepancy: number;
  inventoryDiscrepancyCost: number;
}

export interface ProductSummary {
  productCode: string;
  productName: string;
  totalPurchased: number;
  totalSold: number;
  totalLoss: number;
  expectedInventory: number;
  actualInventory: number;
  totalDiscrepancy: number;
  totalCost: number;
  totalRevenue: number;
  totalGrossProfit: number;
  overallLossRate: number;
  batches: string[];
}

export interface BusinessError {
  code: string;
  message: string;
  details?: string;
  recordId?: string;
  batchId?: string;
  productCode?: string;
}

export interface DataStore {
  products: Map<string, Product>;
  purchases: Map<string, PurchaseRecord>;
  sales: Map<string, SaleRecord>;
  losses: Map<string, LossRecord>;
  inventories: Map<string, InventoryRecord>;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: BusinessError[];
}

export interface ReportData {
  generatedAt: number;
  summary: {
    totalProducts: number;
    totalBatches: number;
    totalPurchased: number;
    totalSold: number;
    totalLoss: number;
    expectedInventory: number;
    actualInventory: number;
    totalDiscrepancy: number;
    totalCost: number;
    totalRevenue: number;
    totalGrossProfit: number;
    overallLossRate: number;
  };
  productSummaries: ProductSummary[];
  batchCalculations: BatchCalculation[];
  exceptions: BusinessError[];
  needsReview: {
    batches: string[];
    records: string[];
  };
}
