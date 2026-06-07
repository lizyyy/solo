export interface Contract {
  id: string;
  contractNo: string;
  contractDate: string;
  screenshotUrl?: string;
  totalAmount: number;
  status: 'draft' | 'imported' | 'reviewing' | 'confirmed';
  createdAt: string;
  step: 1 | 2 | 3;
}

export interface Track {
  id: string;
  contractId: string;
  trackName: string;
  nameType: '现场名' | '版权名' | '未知';
  amount: number;
  remarks?: string;
  reviewStatus: '正常' | '待复核' | '已确认' | '已驳回';
  matchedCanonicalName?: string;
}

export interface TrackAlias {
  id: string;
  canonicalName: string;
  aliasName: string;
  aliasType: '现场名' | '版权名';
  source: '合同' | '别名表' | '人工';
  createdAt: string;
}

export type ConflictType = '名称冲突' | '金额矛盾' | '别名缺失' | '双重身份';

export interface Conflict {
  id: string;
  type: ConflictType;
  trackId: string;
  aliasId?: string;
  evidence: {
    contractEvidence?: string;
    aliasEvidence?: string;
    amountDiff?: number;
  };
  status: '待处理' | '已确认' | '已驳回';
  handler?: string;
  handledAt?: string;
  remarks?: string;
  createdAt: string;
}

export type CheckType = '重复导入' | '同名异曲' | '补录重算' | '导出一致';

export interface CheckItem {
  id: string;
  resultId: string;
  level: '错误' | '警告' | '通过';
  description: string;
  evidence?: string;
}

export interface SelfCheckResult {
  id: string;
  checkType: CheckType;
  runAt: string;
  status: 'running' | 'completed' | 'failed';
  summary: string;
  items: CheckItem[];
}

export interface WeeklyReport {
  id: string;
  weekNumber: number;
  year: number;
  totalAmount: number;
  trackCount: number;
  contractCount: number;
  generatedAt: string;
  details: {
    canonicalName: string;
    trackCount: number;
    totalAmount: number;
  }[];
}

export interface OperationLog {
  id: string;
  operationType: string;
  operator: string;
  targetId?: string;
  beforeData?: string;
  afterData?: string;
  timestamp: string;
  description: string;
}

export interface AppState {
  contracts: Contract[];
  tracks: Track[];
  trackAliases: TrackAlias[];
  conflicts: Conflict[];
  selfCheckResults: SelfCheckResult[];
  weeklyReports: WeeklyReport[];
  operationLogs: OperationLog[];
  
  importContract: (data: Omit<Contract, 'id' | 'createdAt' | 'status' | 'step'>, tracks: Omit<Track, 'id' | 'contractId' | 'reviewStatus'>[]) => void;
  addTrackAlias: (alias: Omit<TrackAlias, 'id' | 'createdAt'>) => void;
  resolveConflict: (id: string, action: 'confirm' | 'reject', handler: string, remarks?: string) => void;
  runSelfCheck: (type: CheckType) => SelfCheckResult;
  runAllSelfChecks: () => SelfCheckResult[];
  generateWeeklyReport: (weekNumber: number, year: number) => WeeklyReport;
  exportData: () => string;
  addOperationLog: (log: Omit<OperationLog, 'id' | 'timestamp'>) => void;
  getTracksByCanonicalName: (canonicalName: string) => Track[];
  getConflictsByStatus: (status: Conflict['status']) => Conflict[];
}
