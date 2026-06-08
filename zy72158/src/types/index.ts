export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'need_confirm' | 'legacy';

export type SourceType = 'street_form' | 'site_photo' | 'approval_record' | 'gis_legacy';

export type ApprovalType = 'capacity_check' | 'time_conflict' | 'manual_review';

export type ApprovalResult = 'pass' | 'fail' | 'warning';

export interface SourceTrace {
  id: string;
  sourceType: SourceType;
  sourceName: string;
  importTime: string;
  rawData: string;
}

export interface ApprovalRecord {
  id: string;
  type: ApprovalType;
  result: ApprovalResult;
  description: string;
  createdAt: string;
  operator: string;
}

export interface OutdoorStall {
  id: string;
  name: string;
  location: string;
  lat: number;
  lng: number;
  area: number;
  maxArea: number;
  timePeriod: string;
  status: ApprovalStatus;
  humanRemark?: string;
  createdAt: string;
  updatedAt: string;
  sources: SourceTrace[];
  approvalRecords: ApprovalRecord[];
  contact?: string;
  phone?: string;
}

export interface ConflictResult {
  hasConflict: boolean;
  type: 'capacity' | 'time' | 'location';
  description: string;
  suggestion: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ImportData {
  name: string;
  location: string;
  area: number;
  timePeriod: string;
  lat?: number;
  lng?: number;
  contact?: string;
  phone?: string;
  sourceType: SourceType;
  sourceName: string;
  rawData: string;
}
