export type RawStatus = 'confirmed' | 'pending' | 'returned';

export type DisplayStatus = '已确认' | '待补件' | '退回';

export type StatusFilter = 'all' | 'confirmed' | 'pending' | 'returned';

export interface RawRecord {
  id: string;
  scheduleDate: string;
  petType: string;
  ownerName: string;
  wechatRemark: string;
  rawWeight: string;
  tempPlan: string;
  status: RawStatus;
  missingItems: string;
  returnReason: string;
  hasFollowUp: boolean;
}

export interface ProcessedRecord extends RawRecord {
  normalizedWeightGrams: number;
  weightUnitMixed: boolean;
  weightUnitNote: string;
  displayStatus: DisplayStatus;
  remarkIssue: boolean;
}

export interface FilterState {
  statusFilter: StatusFilter;
  dateFrom: string;
  dateTo: string;
  ownerKeyword: string;
}

export interface ReconciliationStore {
  rawRecords: RawRecord[];
  processedRecords: ProcessedRecord[];
  filters: FilterState;
  derivedResult: ProcessedRecord[];
  setStatusFilter: (s: StatusFilter) => void;
  setDateFrom: (d: string) => void;
  setDateTo: (d: string) => void;
  setOwnerKeyword: (k: string) => void;
  resetFilters: () => void;
  stats: {
    total: number;
    confirmed: number;
    pending: number;
    returned: number;
  };
  summary: {
    totalText: string;
    doneText: string;
    missingList: { name: string; items: string[] }[];
    returnedList: { name: string; reason: string }[];
    remarkIssueList: { name: string; remark: string }[];
  };
}
