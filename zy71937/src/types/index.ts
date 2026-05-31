export type TaskStatus = 'draft' | 'pending' | 'confirmed' | 'exported' | 'withdrawn' | 'archived';

export type AnomalyType = 
  | 'color_mismatch' 
  | 'spec_mismatch' 
  | 'auth_expired' 
  | 'duplicate_import'
  | 'filter_inconsistent';

export type Department = 'design' | 'marketing' | 'printing';

export interface ExportSpec {
  id: string;
  name: string;
  dpi: number;
  format: 'PDF' | 'AI' | 'PNG' | 'JPG';
  colorMode: 'CMYK' | 'RGB';
  bleed: number;
  version: number;
  createdAt: string;
  isActive: boolean;
}

export interface AnomalyRecord {
  id: string;
  type: AnomalyType;
  severity: 'warning' | 'error' | 'critical';
  description: string;
  reviewNote?: string;
  isResolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
  createdBy: string;
}

export interface DisplayItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  colorVersion: string;
  quantity: number;
  storeIds: string[];
}

export interface TaskHistory {
  id: string;
  taskId: string;
  action: string;
  description: string;
  operator: string;
  timestamp: string;
  snapshot?: Partial<DisplayTask>;
}

export interface DisplayTask {
  id: string;
  name: string;
  season: string;
  year: number;
  department: Department;
  status: TaskStatus;
  items: DisplayItem[];
  exportSpecId: string;
  anomalies: AnomalyRecord[];
  history: TaskHistory[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  confirmedAt?: string;
  confirmedBy?: string;
  exportedAt?: string;
  exportedBy?: string;
  filterCriteria?: Record<string, string[]>;
  importBatchId?: string;
}

export interface FilterState {
  status?: TaskStatus[];
  department?: Department[];
  season?: string[];
  hasAnomalies?: boolean;
  searchText?: string;
}

export interface ExportValidationResult {
  isValid: boolean;
  issues: {
    type: AnomalyType;
    message: string;
    affectedItems: string[];
  }[];
  summary: {
    totalItems: number;
    validItems: number;
    warningCount: number;
    errorCount: number;
  };
}
