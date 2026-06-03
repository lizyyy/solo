export enum RecordStatus {
  PENDING = 'pending',
  NORMAL = 'normal',
  PENDING_REVIEW = 'pending_review',
  OLD_CALIBER = 'old_caliber',
}

export enum RecordType {
  SMOOTH = 'smooth',
  SUPPLEMENT_NO_RECALC = 'supplement_no_recalc',
  OLD_CALIBER_FILL = 'old_caliber_fill',
}

export enum ProcessStep {
  NOT_STARTED = 'not_started',
  IMPORT = 'import',
  CAD_SUPPLEMENT = 'cad',
  EXPORT = 'export',
  COMPLETED = 'completed',
}

export interface InspectionRecord {
  id: string;
  photoNo: string;
  cadLayerName: string;
  routeLength: number | null;
  originalLength: number | null;
  correctedLength: number | null;
  status: RecordStatus;
  recordType: RecordType;
  caliber: string;
  lengthRecalculated: boolean;
  hasManualCorrection: boolean;
  hasRerun: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AuditAction = 'import' | 'calculate' | 'cad_update' | 'manual_correct' | 'rerun' | 'export';

export interface AuditLogEntry {
  id: string;
  recordId: string;
  operator: string;
  action: AuditAction;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  remark: string;
  timestamp: string;
}

export interface ProcessState {
  currentStep: ProcessStep;
  importCompleted: boolean;
  cadCompleted: boolean;
  exportCompleted: boolean;
  activeRecordId: string | null;
}

export const STATUS_LABELS: Record<RecordStatus, string> = {
  [RecordStatus.PENDING]: '临时数据',
  [RecordStatus.NORMAL]: '正常 ✓',
  [RecordStatus.PENDING_REVIEW]: '待复核 ⚠',
  [RecordStatus.OLD_CALIBER]: '旧口径 ✓',
};

export const RECORD_TYPE_LABELS: Record<RecordType, string> = {
  [RecordType.SMOOTH]: '顺利记录',
  [RecordType.SUPPLEMENT_NO_RECALC]: '补录未重算',
  [RecordType.OLD_CALIBER_FILL]: '旧口径回填',
};

export const STEP_LABELS: Record<ProcessStep, string> = {
  [ProcessStep.NOT_STARTED]: '未开始',
  [ProcessStep.IMPORT]: '第一步：导入巡检照片编号',
  [ProcessStep.CAD_SUPPLEMENT]: '第二步：补录CAD图层名',
  [ProcessStep.EXPORT]: '第三步：导出截图',
  [ProcessStep.COMPLETED]: '流程完成',
};
