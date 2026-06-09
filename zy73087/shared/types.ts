export type MaterialStatus = 'pending' | 'normal' | 'rejudged' | 'changing' | 'archived';

export type HistoryAction =
  | 'create'
  | 'update'
  | 'rejudge'
  | 'cad_note'
  | 'change_order'
  | 'csv_import'
  | 'csv_update';

export interface Material {
  id: string;
  materialCode: string;
  materialName: string;
  specification: string;
  quantity: number;
  unit: string;
  projectName: string;
  layerCode: string;
  position: string;
  status: MaterialStatus;
  collisionPoint: string;
  cadNote: string;
  cadJudgmentChange: string;
  changeOrderNo: string;
  changeOrderReason: string;
  changeOrderImpact: string;
  manualNote: string;
  importBatchNo: string;
  createdAt: string;
  updatedAt: string;
}

export interface HistoryRecord {
  id: string;
  materialId: string;
  materialCode: string;
  action: HistoryAction;
  oldStatus?: MaterialStatus;
  newStatus?: MaterialStatus;
  fieldChanges: Record<string, { old: any; new: any }>;
  operator: string;
  remark: string;
  createdAt: string;
}

export interface RejudgeRequest {
  newStatus: MaterialStatus;
  reason: string;
  relatedLayer: string;
  collisionDesc: string;
  operator: string;
}

export interface CadNoteRequest {
  cadNote: string;
  cadJudgmentChange: string;
  operator: string;
}

export interface ChangeOrderRequest {
  changeOrderNo: string;
  changeOrderReason: string;
  changeOrderImpact: string;
  operator: string;
}

export interface CsvImportResult {
  totalRows: number;
  newCount: number;
  updatedCount: number;
  skippedCount: number;
  duplicates: Array<{ row: number; materialCode: string; reason: string; hasManualNote: boolean }>;
  batchNo: string;
}

export const STATUS_LABELS: Record<MaterialStatus, string> = {
  pending: '待确认',
  normal: '正常',
  rejudged: '已改判',
  changing: '变更中',
  archived: '已归档',
};

export const STATUS_COLORS: Record<MaterialStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-300',
  normal: 'bg-teal-100 text-teal-800 border-teal-300',
  rejudged: 'bg-blue-100 text-blue-800 border-blue-300',
  changing: 'bg-purple-100 text-purple-800 border-purple-300',
  archived: 'bg-gray-200 text-gray-700 border-gray-400',
};

export const ACTION_LABELS: Record<HistoryAction, string> = {
  create: '新增记录',
  update: '更新信息',
  rejudge: '状态改判',
  cad_note: 'CAD备注',
  change_order: '变更单补录',
  csv_import: 'CSV新增',
  csv_update: 'CSV更新',
};

export const CSV_COLUMNS: Array<{ key: keyof Material | 'changeNote'; label: string }> = [
  { key: 'materialCode', label: '材料编号' },
  { key: 'materialName', label: '材料名称' },
  { key: 'specification', label: '规格型号' },
  { key: 'quantity', label: '数量' },
  { key: 'unit', label: '单位' },
  { key: 'projectName', label: '项目名称' },
  { key: 'layerCode', label: 'CAD图层号' },
  { key: 'position', label: '图纸位置' },
  { key: 'status', label: '当前状态' },
  { key: 'collisionPoint', label: '碰撞点说明' },
  { key: 'cadNote', label: 'CAD图层备注' },
  { key: 'cadJudgmentChange', label: 'CAD改变的判断' },
  { key: 'changeOrderNo', label: '变更单号' },
  { key: 'changeOrderReason', label: '变更确认理由' },
  { key: 'changeOrderImpact', label: '变更影响范围' },
  { key: 'manualNote', label: '人工备注' },
  { key: 'changeNote', label: '变化说明' },
];
