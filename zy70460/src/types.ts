export interface LiveSample {
  id: string;
  batchId: string;
  productId: string;
  productName: string;
  sku: string;
  liveDate: string;
  anchorName: string;
  platform: string;
  price: number;
  stock: number;
  category: string;
  brand: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

export interface DuplicateGroup {
  groupId: string;
  key: string;
  keyType: 'productId' | 'sku' | 'name' | 'composite';
  items: DuplicateItem[];
  riskLevel: 'high' | 'medium' | 'low';
  detectedAt: string;
}

export interface DuplicateItem {
  sample: LiveSample;
  isTruncated: boolean;
  truncationFields: string[];
  confidence: number;
}

export interface ManualCorrection {
  correctionId: string;
  batchId: string;
  groupId: string;
  itemId: string;
  operator: string;
  remark: string;
  action: 'keep' | 'merge' | 'mark_non_duplicate' | 'dismiss';
  source: string;
  basis: string;
  correctedAt: string;
}

export interface DetectionHistory {
  historyId: string;
  batchId: string;
  operator: string;
  riskType: string;
  detectedAt: string;
  duplicateGroups: DuplicateGroup[];
  corrections: ManualCorrection[];
}

export interface OutputConfig {
  format: 'json' | 'markdown' | 'csv';
  includeSystemJudgment: boolean;
  includeCorrections: boolean;
}

export type FilterType = 'batch' | 'operator' | 'riskType';
