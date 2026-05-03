export interface Sale {
  orderId: string;
  timestamp: string;
  date: string;
  stallId: string;
  stallName: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  paymentMethod: 'wechat' | 'alipay' | 'cash' | 'other';
  paymentId?: string;
  notes?: string;
}

export interface Payment {
  paymentId: string;
  orderId?: string;
  timestamp: string;
  date: string;
  stallId: string;
  amount: number;
  method: 'wechat' | 'alipay' | 'cash' | 'other';
  status: 'success' | 'pending' | 'failed' | 'refunded';
  fee?: number;
  notes?: string;
}

export interface InventoryItem {
  productId: string;
  productName: string;
  category: string;
  unitCost: number;
  unitPrice: number;
  initialStock: number;
  currentStock: number;
  minStock: number;
  unit: string;
  supplier?: string;
  lastRestockDate?: string;
}

export interface InventoryRecord {
  recordId: string;
  timestamp: string;
  date: string;
  stallId: string;
  type: 'restock' | 'sale' | 'damage' | 'return' | 'adjustment';
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  reason?: string;
  relatedOrderId?: string;
  notes?: string;
}

export interface Inventory {
  items: InventoryItem[];
  records: InventoryRecord[];
}

export interface Fee {
  feeId: string;
  date: string;
  stallId: string;
  stallName: string;
  type: 'rental' | 'utility' | 'cleaning' | 'marketing' | 'other';
  amount: number;
  description: string;
  paidBy?: string;
  paymentMethod?: string;
  notes?: string;
}

export interface Return {
  returnId: string;
  timestamp: string;
  date: string;
  stallId: string;
  originalOrderId: string;
  productId: string;
  productName: string;
  quantity: number;
  refundAmount: number;
  reason: string;
  paymentMethod: 'wechat' | 'alipay' | 'cash' | 'other';
  refundId?: string;
  notes?: string;
}

export interface Config {
  stallIds: string[];
  stallNames: Record<string, string>;
  
  fees: {
    defaultRentalFee: number;
    utilityFeePerDay: number;
    cleaningFeePerDay: number;
    marketingFeePerDay: number;
  };
  
  platformFees: {
    wechat: number;
    alipay: number;
    cash: number;
    other: number;
  };
  
  taxes: {
    rate: number;
    threshold: number;
    enabled: boolean;
  };
  
  inventory: {
    damageWarningThreshold: number;
    negativeStockWarning: boolean;
    autoAdjust: boolean;
  };
  
  businessHours: {
    crossDayCutoff: string;
    startHour: number;
    endHour: number;
  };
  
  currency: {
    symbol: string;
    decimalPlaces: number;
  };
  
  output: {
    defaultFormat: 'console' | 'markdown' | 'csv' | 'json';
    exportDirectory: string;
  };
}

export interface ValidationError {
  type: 'missing_field' | 'duplicate_order' | 'payment_mismatch' | 'negative_stock' | 'return_no_order' | 'cross_day_hours' | 'invalid_value' | 'missing_reference';
  severity: 'error' | 'warning' | 'info';
  message: string;
  impactOnProfit: string;
  actionRequired: string;
  details: {
    field?: string;
    value?: string | number;
    expected?: string | number;
    recordId?: string;
    orderId?: string;
    paymentId?: string;
    productId?: string;
    date?: string;
    stallId?: string;
    initialStock?: number;
    totalSold?: number;
    totalReturned?: number;
    returnId?: string;
    refundAmount?: number;
    feeId?: string;
    dates?: string;
    cutoffTime?: string;
    [key: string]: any;
  };
}

export interface ValidationResult {
  valid: boolean;
  totalErrors: number;
  totalWarnings: number;
  errors: ValidationError[];
  warnings: ValidationError[];
  summary: {
    missingFields: number;
    duplicateOrders: number;
    paymentMismatches: number;
    negativeStock: number;
    invalidReturns: number;
    crossDayIssues: number;
  };
}

export interface DailyProfit {
  date: string;
  stallId: string;
  stallName: string;
  
  sales: {
    totalOrders: number;
    totalQuantity: number;
    grossRevenue: number;
    byPaymentMethod: Record<string, number>;
    byProduct: Record<string, { quantity: number; revenue: number; cost: number }>;
  };
  
  costs: {
    costOfGoodsSold: number;
    byProduct: Record<string, number>;
  };
  
  returns: {
    totalReturns: number;
    totalQuantity: number;
    totalRefundAmount: number;
    returnedCost: number;
    byProduct: Record<string, { quantity: number; refundAmount: number; cost: number }>;
  };
  
  damages: {
    totalItems: number;
    totalCost: number;
    byProduct: Record<string, { quantity: number; cost: number }>;
  };
  
  fees: {
    totalFees: number;
    byType: Record<string, number>;
    rentalFee: number;
    utilityFee: number;
    cleaningFee: number;
    marketingFee: number;
  };
  
  platformFees: {
    totalFees: number;
    byMethod: Record<string, number>;
  };
  
  taxes: {
    estimatedTax: number;
    taxableAmount: number;
  };
  
  profit: {
    grossProfit: number;
    operatingProfit: number;
    netProfit: number;
    profitMargin: number;
  };
}

export interface ReconciliationResult {
  period: {
    startDate: string;
    endDate: string;
  };
  
  dailySummary: DailyProfit[];
  
  overall: {
    totalRevenue: number;
    totalCost: number;
    totalReturns: number;
    totalDamages: number;
    totalFees: number;
    totalPlatformFees: number;
    totalTaxes: number;
    grossProfit: number;
    netProfit: number;
    profitMargin: number;
  };
  
  byStall: Record<string, {
    stallName: string;
    totalRevenue: number;
    totalCost: number;
    netProfit: number;
    profitMargin: number;
    dailyData: DailyProfit[];
  }>;
  
  byProduct: Record<string, {
    productName: string;
    category: string;
    totalQuantitySold: number;
    totalQuantityReturned: number;
    totalRevenue: number;
    totalCost: number;
    netProfit: number;
    profitMargin: number;
  }>;
  
  issues: ValidationError[];
  actionItems: ActionItem[];
}

export interface ActionItem {
  priority: 'high' | 'medium' | 'low';
  category: 'payment' | 'inventory' | 'return' | 'fee' | 'other';
  description: string;
  impact: string;
  suggestedAction: string;
  relatedRecords: string[];
}

export interface ComparisonResult {
  basePeriod: {
    startDate: string;
    endDate: string;
    reconciliation: ReconciliationResult;
  };
  
  comparePeriod: {
    startDate: string;
    endDate: string;
    reconciliation: ReconciliationResult;
  };
  
  differences: {
    revenue: {
      base: number;
      compare: number;
      absoluteChange: number;
      percentageChange: number;
    };
    
    cost: {
      base: number;
      compare: number;
      absoluteChange: number;
      percentageChange: number;
    };
    
    netProfit: {
      base: number;
      compare: number;
      absoluteChange: number;
      percentageChange: number;
    };
    
    profitMargin: {
      base: number;
      compare: number;
      absoluteChange: number;
    };
    
    byStall: Record<string, {
      stallName: string;
      revenueChange: number;
      revenueChangePercent: number;
      profitChange: number;
      profitChangePercent: number;
    }>;
    
    byProduct: Record<string, {
      productName: string;
      quantityChange: number;
      quantityChangePercent: number;
      revenueChange: number;
      revenueChangePercent: number;
      profitChange: number;
      profitChangePercent: number;
    }>;
  };
  
  insights: string[];
}

export interface ExportOptions {
  format: 'markdown' | 'csv' | 'json';
  includeDailyDetails: boolean;
  includeProductDetails: boolean;
  includeStallDetails: boolean;
  includeActionItems: boolean;
  includeIssues: boolean;
  outputPath?: string;
  fileName?: string;
}

export interface LoadedData {
  sales: Sale[];
  payments: Payment[];
  inventory: Inventory;
  fees: Fee[];
  returns: Return[];
  config: Config;
}

export interface CommandOptions {
  inputDir: string;
  outputDir: string;
  configPath?: string;
  startDate?: string;
  endDate?: string;
  stallId?: string;
  verbose: boolean;
  quiet: boolean;
}
