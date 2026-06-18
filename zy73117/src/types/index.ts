export type MaterialStatus = 'normal' | 'withdrawn' | 'changed' | 'exception';
export type RecordType = 'create' | 'withdraw' | 'change' | 'note';

export interface DateRange {
  start: string | null;
  end: string | null;
}

export interface TraceRecord {
  id: string;
  materialId: string;
  type: RecordType;
  content: string;
  operator: string;
  operateTime: string;
  previousConclusion: string;
  newConclusion: string;
  reason: string;
  changeOrderNo: string;
  hasChangeOrder: boolean;
  changeOrderLate: boolean;
  remark: string;
}

export interface Material {
  id: string;
  projectName: string;
  buildingNo: string;
  materialType: string;
  surveyNo: string;
  status: MaterialStatus;
  currentConclusion: string;
  originalConclusion: string;
  importDate: string;
  recordIds: string[];
  manualNote: string;
  screenshotUrl: string;
  screenshotNote: string;
  exceptionReason: string;
  nextStep: string;
  isPending: boolean;
}

export interface FilterState {
  statuses: MaterialStatus[];
  keyword: string;
  dateRange: DateRange;
  buildingNo: string;
  onlyPending: boolean;
  onlyException: boolean;
}

export interface ChangeExplanation {
  recordId: string;
  text: string;
  hasWithdrawnChain: boolean;
  withdrawnToFinal: string | null;
}

export interface AppState {
  materials: Material[];
  records: TraceRecord[];
  filters: FilterState;
  selectedMaterialId: string | null;
  expandedRecordId: string | null;
  showFiltersRestored: boolean;
  notifications: NotificationItem[];
}

export interface NotificationItem {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  nextStep?: string;
  actions?: {
    label: string;
    onClick: () => void;
  }[];
}

export const STATUS_LABELS: Record<MaterialStatus, string> = {
  normal: '正常',
  withdrawn: '已撤回',
  changed: '已变更',
  exception: '异常',
};

export const STATUS_COLORS: Record<MaterialStatus, string> = {
  normal: 'bg-success-500',
  withdrawn: 'bg-danger-500',
  changed: 'bg-primary-400',
  exception: 'bg-warning-500',
};

export const RECORD_TYPE_LABELS: Record<RecordType, string> = {
  create: '创建',
  withdraw: '撤回',
  change: '变更',
  note: '备注',
};
