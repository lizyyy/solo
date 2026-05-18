export interface Dish {
  dishId: string;
  dishName: string;
  dishType: '预制菜' | '现制菜' | '组合菜';
  status: '上架' | '下架' | '定时上架';
  scheduledOnTime?: string;
  scheduledOffTime?: string;
  isCombo: boolean;
  comboComponents?: string[];
  category: string;
  price: number;
}

export interface StoreInventory {
  storeId: string;
  storeName: string;
  dishId: string;
  dishName: string;
  stockQuantity: number;
  unit: string;
  lastUpdated: string;
}

export interface HeadquartersNotice {
  noticeId: string;
  noticeDate: string;
  noticeType: '下架通知' | '上架通知' | '调整通知';
  targetDishIds: string[];
  reason: string;
  effectiveDate: string;
  effectiveStores?: string[];
}

export interface ShelfVerificationResult {
  verificationId: string;
  verificationDate: string;
  affectedDishes: AffectedDish[];
  summary: VerificationSummary;
}

export interface AffectedDish {
  dishId: string;
  dishName: string;
  dishType: string;
  reason: string;
  impactLevel: '高' | '中' | '低';
  affectedStores: AffectedStore[];
  relatedComboDishes: RelatedComboDish[];
  scheduledInfo?: ScheduledInfo;
}

export interface AffectedStore {
  storeId: string;
  storeName: string;
  remainingStock: number;
  unit: string;
  stockValue: number;
}

export interface RelatedComboDish {
  dishId: string;
  dishName: string;
  status: string;
}

export interface ScheduledInfo {
  isScheduled: boolean;
  scheduledTime?: string;
  conflictDescription?: string;
}

export interface VerificationSummary {
  totalAffectedDishes: number;
  totalAffectedStores: number;
  totalStockValue: number;
  highImpactCount: number;
  mediumImpactCount: number;
  lowImpactCount: number;
  comboDishImpactCount: number;
  scheduledConflictCount: number;
  issues: VerificationIssue[];
}

export interface VerificationIssue {
  type: '库存预警' | '组合菜影响' | '定时上架冲突' | '数据异常';
  severity: 'error' | 'warning' | 'info';
  message: string;
  dishId?: string;
  storeId?: string;
}

export interface VerificationConfig {
  dishesFile: string;
  inventoryFile: string;
  noticesFile: string;
  outputFile: string;
  effectiveDate?: string;
}
