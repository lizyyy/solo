export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface CameraState {
  position: Position3D;
  target: Position3D;
  fov: number;
}

export type SourceType = 'gis' | 'tablet' | 'excel' | 'screenshot';
export type CrackType = 'transverse' | 'longitudinal' | 'mesh' | 'suspected';
export type RiskLevel = 'low' | 'medium' | 'high';
export type RecordStatus = 'pending' | 'processing' | 'completed' | 'confirmed';
export type OperationAction = 'create' | 'update' | 'status_change' | 'remark' | 'import';

export interface SourceInfo {
  id: string;
  sourceType: SourceType;
  sourceRef: string;
  originalData: string;
  sourceFile?: string;
  sourceRow?: number;
  importTime?: string;
  importOperator?: string;
}

export interface DiffField {
  field: string;
  oldValue: string;
  newValue: string;
}

export interface OperationHistory {
  id: string;
  operator: string;
  action: OperationAction;
  detail: string;
  timestamp: string;
  cameraState?: CameraState;
  diff?: DiffField[];
}

export interface CrackRecord {
  id: string;
  code: string;
  location: 'root' | 'middle' | 'tip';
  position3D: Position3D;
  crackType: CrackType;
  riskLevel: RiskLevel;
  status: RecordStatus;
  source: SourceType;
  description: string;
  suggestion: string;
  remark: string;
  isOldCaliber: boolean;
  sourceInfo: SourceInfo;
  history: OperationHistory[];
  createdAt: string;
  updatedAt: string;
}

export interface Scheme {
  id: string;
  name: string;
  description: string;
  records: CrackRecord[];
  cameraState: CameraState;
  createdAt: string;
  updatedAt: string;
}

export interface AppState {
  records: CrackRecord[];
  selectedRecordId: string | null;
  cameraState: CameraState;
  schemes: Scheme[];
  activeSchemeId: string | null;
  showCompleted: boolean;
  showDiffPanel: boolean;
  diffRecords: { old: CrackRecord; new: CrackRecord }[];
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
}

export interface AppActions {
  setSelectedRecord: (id: string | null) => void;
  setCameraState: (state: CameraState) => void;
  updateRecord: (id: string, updates: Partial<CrackRecord>) => void;
  updateRecordStatus: (id: string, status: RecordStatus) => void;
  addRecord: (record: Omit<CrackRecord, 'id' | 'createdAt' | 'updatedAt' | 'history'>) => void;
  addRemark: (id: string, remark: string, operator?: string) => void;
  saveScheme: (name: string, description: string) => void;
  loadScheme: (schemeId: string) => void;
  deleteScheme: (schemeId: string) => void;
  setShowCompleted: (show: boolean) => void;
  toggleDiffPanel: (show?: boolean) => void;
  setDiffRecords: (records: { old: CrackRecord; new: CrackRecord }[]) => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  importRecords: (records: Omit<CrackRecord, 'id' | 'createdAt' | 'updatedAt' | 'history'>[]) => void;
  resetToMockData: () => void;
}

export const STATUS_LABELS: Record<RecordStatus, string> = {
  pending: '待处理',
  processing: '处理中',
  completed: '已处理',
  confirmed: '已确认'
};

export const STATUS_COLORS: Record<RecordStatus, string> = {
  pending: 'bg-warning-500',
  processing: 'bg-primary-500',
  completed: 'bg-success-500',
  confirmed: 'bg-dark-500'
};

export const SOURCE_LABELS: Record<SourceType, string> = {
  gis: 'GIS扫描',
  tablet: '巡检平板',
  excel: 'Excel台账',
  screenshot: '周会截图'
};

export const CRACK_TYPE_LABELS: Record<CrackType, string> = {
  transverse: '横向裂纹',
  longitudinal: '纵向裂纹',
  mesh: '网状裂纹',
  suspected: '疑似异常'
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险'
};

export const RISK_COLORS: Record<RiskLevel, string> = {
  low: 'bg-success-500',
  medium: 'bg-warning-500',
  high: 'bg-red-500'
};

export const LOCATION_LABELS: Record<'root' | 'middle' | 'tip', string> = {
  root: '叶根',
  middle: '叶中',
  tip: '叶尖'
};
