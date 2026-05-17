export enum RetestStatus {
  RESULT_ISSUED = '已出结果',
  RETEST_APPLIED = '重测申请',
  RETESTING = '重测中',
  REPLACED = '已替换',
  WITHDRAWN = '已撤回',
  RETEST_FAILED = '重测失败'
}

export interface Sample {
  sampleId: string;
  sampleName: string;
  sampleType: string;
  collectionTime: string;
}

export interface TestItem {
  itemCode: string;
  itemName: string;
  originalResult: string;
  originalResultTime: string;
  retestResult?: string;
  retestResultTime?: string;
}

export interface RetestRequest {
  requestId: string;
  sample: Sample;
  testItems: TestItem[];
  retestReason: string;
  applicant: string;
  applyTime: string;
  auditor?: string;
  auditTime?: string;
  auditOpinion?: string;
  status: RetestStatus;
  version: number;
  isDeleted: boolean;
}

export interface HistoryRecord {
  historyId: string;
  requestId: string;
  operation: string;
  operator: string;
  operateTime: string;
  oldStatus?: RetestStatus;
  newStatus?: RetestStatus;
  remark?: string;
  snapshot: Partial<RetestRequest>;
}

export interface CreateRetestRequest {
  sample: Sample;
  testItems: TestItem[];
  retestReason: string;
  applicant: string;
}

export interface UpdateRetestRequest {
  testItems?: TestItem[];
  retestReason?: string;
}

export interface AuditRequest {
  auditor: string;
  auditOpinion: string;
  approved: boolean;
}

export interface RetestResultRequest {
  itemCode: string;
  retestResult: string;
  operator: string;
  success: boolean;
}
