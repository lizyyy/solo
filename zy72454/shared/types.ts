export type BreakpointStatus = 
  | 'pending_inspection' 
  | 'inspecting' 
  | 'pending_review' 
  | 'confirmed' 
  | 'completed';

export type ChangeType = 'create' | 'update' | 'status_change';

export interface Breakpoint {
  id: string;
  name: string;
  location: string;
  lat: number;
  lng: number;
  status: BreakpointStatus;
  hasConstructionDetour: boolean;
  redlineNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BreakpointWithDetails extends Breakpoint {
  busCardTimes: BusCardTime[];
  historyRecords: HistoryRecord[];
}

export interface BusCardTime {
  id: string;
  breakpointId: string;
  importBatchId: string;
  timeSlot: string;
  passengerCount: number;
  sourceDate: string;
  importedAt: string;
}

export interface ImportBatch {
  id: string;
  fileName: string;
  totalRecords: number;
  duplicateCount: number;
  importedCount: number;
  importedBy: string;
  importedAt: string;
}

export interface HistoryRecord {
  id: string;
  breakpointId: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  changedBy: string;
  changedAt: string;
  changeType: ChangeType;
  snapshot: Record<string, unknown>;
}

export interface BoundaryRule {
  id: string;
  name: string;
  description: string;
  triggerCondition: string;
  judgmentLogic: string;
  modificationMethod: string;
  rollbackMethod: string;
  isActive: boolean;
}

export interface FriendlyError {
  code: string;
  message: string;
  suggestion: string;
  details?: string;
}

export interface BusCardImportItem {
  breakpointName: string;
  location: string;
  lat: number;
  lng: number;
  timeSlot: string;
  passengerCount: number;
  sourceDate: string;
}

export interface ImportPreviewResult {
  items: BusCardImportItem[];
  duplicates: BusCardImportItem[];
  totalCount: number;
  duplicateCount: number;
  newBreakpoints: string[];
}

export const STATUS_LABELS: Record<BreakpointStatus, string> = {
  pending_inspection: '待巡检',
  inspecting: '巡检中',
  pending_review: '待复核',
  confirmed: '已确认',
  completed: '已完成',
};

export const STATUS_COLORS: Record<BreakpointStatus, string> = {
  pending_inspection: 'bg-gray-100 text-gray-700',
  inspecting: 'bg-blue-100 text-blue-700',
  pending_review: 'bg-orange-100 text-orange-700',
  confirmed: 'bg-green-100 text-green-700',
  completed: 'bg-emerald-100 text-emerald-700',
};
