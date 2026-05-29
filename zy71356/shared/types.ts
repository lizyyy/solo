export type Category = 'ceramic' | 'print' | 'food' | 'other';

export const CATEGORY_LABELS: Record<Category, string> = {
  ceramic: '陶瓷',
  print: '版画',
  food: '食品',
  other: '其他',
};

export const CATEGORY_COLORS: Record<Category, string> = {
  ceramic: 'bg-amber-100 text-amber-800 border-amber-300',
  print: 'bg-blue-100 text-blue-800 border-blue-300',
  food: 'bg-rose-100 text-rose-800 border-rose-300',
  other: 'bg-slate-100 text-slate-800 border-slate-300',
};

export interface Vendor {
  id: string;
  name: string;
  category: Category;
  powerRequirement: number;
  contact: string;
  note?: string;
  source?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Stall {
  id: string;
  name: string;
  row: number;
  col: number;
  maxPower: number;
  isEntrance: boolean;
  width: number;
  height: number;
}

export interface Arrangement {
  id: string;
  version: string;
  name: string;
  note?: string;
  createdBy: string;
  createdAt: string;
}

export interface Assignment {
  id: string;
  arrangementId: string;
  stallId: string;
  vendorId: string;
  source?: string;
  assignedAt: string;
}

export interface SwapLog {
  id: string;
  arrangementId: string;
  stallA: string;
  stallB: string;
  reason: string;
  operator: string;
  createdAt: string;
}

export type ConflictType = 'power_mismatch' | 'category_cluster' | 'unrecorded_swap';
export type ConflictSeverity = 'warning' | 'error';

export const CONFLICT_TYPE_LABELS: Record<ConflictType, string> = {
  power_mismatch: '高功率错配',
  category_cluster: '同类过度集中',
  unrecorded_swap: '临时换位无记录',
};

export const CONFLICT_SEVERITY_COLORS: Record<ConflictSeverity, string> = {
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  error: 'bg-red-50 border-red-200 text-red-800',
};

export interface Conflict {
  id: string;
  arrangementId: string;
  type: ConflictType;
  severity: ConflictSeverity;
  message: string;
  affectedItems: string[];
  source?: string;
  rowNumber?: number;
  createdAt: string;
}

export interface ImportError {
  row: number;
  field: string;
  value: string;
  message: string;
  source: string;
}

export interface ArrangementWithDetails extends Arrangement {
  assignments: Assignment[];
  conflicts: Conflict[];
  swapLogs: SwapLog[];
}

export interface AssignmentWithDetails extends Assignment {
  vendor: Vendor;
  stall: Stall;
}
