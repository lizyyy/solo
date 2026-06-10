export type RecordStatus = "pending" | "confirmed" | "revoked";

export type LogAction =
  | "import"
  | "confirm"
  | "revoke"
  | "remark"
  | "mark_late"
  | "unmark_late"
  | "update"
  | "supplement";

export interface MaterialRecord {
  id: string;
  batchNo: string;
  materialNo: string;
  title: string;
  content: string;
  status: RecordStatus;
  remark: string;
  isLateChange: boolean;
  version: number;
  parentId?: string;
  operator: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChangeLog {
  id: string;
  recordId: string;
  batchNo: string;
  action: LogAction;
  operator: string;
  detail: string;
  timestamp: string;
  materialNo?: string;
  title?: string;
}

export interface ImportItem {
  materialNo: string;
  title: string;
  content: string;
  remark?: string;
  isLateChange?: boolean;
}

export interface ImportPreviewItem extends ImportItem {
  _key: string;
  _isDuplicate: boolean;
  _duplicateReason?: string;
  _isSupplement: boolean;
  _previousVersion?: number;
  _previousId?: string;
}

export interface ImportResult {
  batchNo: string;
  imported: MaterialRecord[];
  skipped: { item: ImportItem; reason: string }[];
  supplemented: { newId: string; parentId: string; materialNo: string }[];
}

export interface FilterOptions {
  keyword?: string;
  batchNo?: string;
  status?: RecordStatus | "all";
  isLateChange?: boolean | "all";
  operator?: string;
  action?: LogAction | "all";
  dateFrom?: string;
  dateTo?: string;
  materialNo?: string;
}

export interface HandoverChecklist {
  materials: string[];
  records: string[];
  timeline: string[];
}
