export type ItemStatus = 'normal' | 'pending' | 'failed';

export type DataSource = 'inventory' | 'sales' | 'replenishment';

export interface NormalItem {
  id: string;
  sku: string;
  skuName: string;
  quantity: number;
  source: DataSource;
  storeId: string;
}

export interface PendingItem {
  id: string;
  sku: string;
  skuName: string;
  quantity: number;
  source: DataSource;
  reason: string;
  confidence: number;
  storeId: string;
}

export interface FailedItem {
  id: string;
  originalData: Record<string, any>;
  source: DataSource;
  errorType: string;
  errorMessage: string;
  suggestion: string;
  storeId: string;
}

export interface ImportResponse {
  batchId: string;
  storeId: string;
  processedAt: string;
  isDuplicate: boolean;
  summary: {
    total: number;
    normal: number;
    pending: number;
    failed: number;
  };
  data: {
    normal: NormalItem[];
    pending: PendingItem[];
    failed: FailedItem[];
  };
}

export interface BatchRecord {
  batchId: string;
  storeId: string;
  processedAt: string;
  result: ImportResponse;
}

export interface SkuAlias {
  standardSku: string;
  standardName: string;
  aliases: string[];
}

export interface ValidationRule {
  name: string;
  type: 'error' | 'warning';
  validate: (item: any, context: ValidationContext) => ValidationResult;
}

export interface ValidationContext {
  storeId: string;
  skuAliases: SkuAlias[];
  expectedSales?: Record<string, number>;
}

export interface ValidationResult {
  passed: boolean;
  errorType?: string;
  message?: string;
  suggestion?: string;
  confidence?: number;
}
