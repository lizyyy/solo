export type RecordStatus = 'pending' | 'approved' | 'rejected' | 'returned';
export type FollowUpStatus = 'pending' | 'completed' | 'skipped';

export interface Customer {
  id: string;
  name: string;
  idCard: string;
  phone: string;
  tags: string[];
  address: string;
  createdAt: number;
}

export interface Medicine {
  id: string;
  name: string;
  category: string;
  isControlled: boolean;
  contraindications: string[];
  minIntervalDays: number;
  maxDosage: number;
}

export interface PurchaseRecord {
  id: string;
  batchId: string;
  customerId: string;
  medicineId: string;
  quantity: number;
  purchaseDate: number;
  status: RecordStatus;
  processedBy: string | null;
  processedAt: number | null;
  followUpDate: number | null;
  notes: string | null;
}

export interface FollowUpRule {
  id: string;
  medicineCategory: string;
  daysAfterPurchase: number;
  requiredChecks: string[];
  description: string;
}

export interface AuditLog {
  id: string;
  recordId: string;
  action: string;
  reason: string;
  operator: string;
  timestamp: number;
  details: Record<string, any>;
}

export interface Batch {
  id: string;
  sourceFile: string;
  recordCount: number;
  status: 'processing' | 'completed' | 'failed';
  createdAt: number;
  createdBy: string;
}

export interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
  warnings: string[];
  batchId: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface QueryFilter {
  customerTags?: string[];
  medicineCategories?: string[];
  followUpPlan?: string;
  status?: RecordStatus;
  startDate?: number;
  endDate?: number;
}
