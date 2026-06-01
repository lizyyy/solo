export type SourceType = 'point_table' | 'photo' | 'manual_edit' | 'remark';

export type ComponentStatus = 'normal' | 'empty' | 'duplicate' | 'boundary';

export interface HeritageComponent {
  id: string;
  name: string;
  x: number | null;
  y: number | null;
  z: number | null;
  coordinateSystem: string;
  source: string;
  sourceType: SourceType;
  status: ComponentStatus;
  isAnomaly: boolean;
  remark: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, any>;
}

export interface CameraState {
  position: [number, number, number];
  target: [number, number, number];
}

export interface Scheme {
  id: string;
  name: string;
  description: string;
  componentIds: string[];
  cameraState: CameraState;
  createdAt: string;
  updatedAt: string;
}

export interface FilterState {
  coordinateSystem?: string;
  sourceType?: SourceType;
  isAnomaly?: boolean;
  search?: string;
  status?: ComponentStatus;
}

export interface AppState {
  components: HeritageComponent[];
  selectedComponentId: string | null;
  currentScheme: Scheme | null;
  schemes: Scheme[];
  filter: FilterState;
  cameraState: CameraState;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
}

export interface AppActions {
  setSelectedComponent: (id: string | null) => void;
  updateComponent: (id: string, updates: Partial<HeritageComponent>) => void;
  toggleAnomaly: (id: string) => void;
  setFilter: (filter: Partial<FilterState>) => void;
  resetFilter: () => void;
  saveScheme: (name: string, description: string) => void;
  loadScheme: (schemeId: string) => void;
  deleteScheme: (schemeId: string) => void;
  setCameraState: (state: CameraState) => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  resetCamera: () => void;
  exportScreenshot: () => Promise<void>;
  exportData: () => void;
}

export const COORDINATE_COLORS: Record<string, string> = {
  'CAD-2000': '#4a90d9',
  '现场测量': '#5bb88d',
  '手绘草图': '#9b7cc9',
  '默认': '#6b7280',
};

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  point_table: '点位表',
  photo: '现场照片',
  manual_edit: '手改坐标',
  remark: '方案备注',
};

export const STATUS_LABELS: Record<ComponentStatus, string> = {
  normal: '正常',
  empty: '空值',
  duplicate: '重复',
  boundary: '边界',
};
