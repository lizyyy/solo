export enum SupplementStatus {
  PENDING = 'PENDING',
  RECEIVED = 'RECEIVED',
  CONFLICT = 'CONFLICT',
  ARCHIVED = 'ARCHIVED'
}

export interface SupplementRecord {
  id?: number;
  waybill_no: string;
  carrier: string;
  node_time: string;
  node_type?: string;
  supplement_source: string;
  status: SupplementStatus;
  handler?: string;
  business_object?: string;
  conflict_info?: string;
  remark?: string;
  created_at?: string;
  updated_at?: string;
}

export interface HistoryLog {
  id?: number;
  record_id: number;
  action: string;
  from_status?: string;
  to_status?: string;
  operator?: string;
  remark?: string;
  change_detail?: string;
  created_at?: string;
}

export interface QueryFilter {
  startDate?: string;
  endDate?: string;
  status?: SupplementStatus;
  handler?: string;
  business_object?: string;
  waybill_no?: string;
  carrier?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ConflictInfo {
  existingRecord: SupplementRecord;
  newRecord: Partial<SupplementRecord>;
  conflictFields: string[];
}
