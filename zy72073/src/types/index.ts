export interface PointData {
  id: string;
  name: string;
  deviceName: string;
  position: { x: number; y: number; z: number; floor: number };
  status: 'normal' | 'warning' | 'error' | 'pending';
  source: 'system' | 'photo' | 'manual';
  sourceRef: string;
  photos: string[];
  anomalyType?: string;
  conflict?: ConflictData;
  processHistory: ProcessRecord[];
  createdAt: string;
  updatedAt: string;
  crossFloor?: {
    linkedPointId: string;
    description: string;
  };
}

export interface ConflictData {
  id: string;
  type: 'coordinate' | 'device_name' | 'status' | 'missing_photo';
  systemData: Partial<PointData>;
  photoData: Partial<PointData>;
  evidence: {
    system: string;
    photo: string;
  };
  suggestion: string;
  resolved: boolean;
  resolution?: 'use_system' | 'use_photo' | 'manual';
}

export interface ProcessRecord {
  id: string;
  timestamp: string;
  operator: string;
  action: string;
  remark: string;
  status: string;
}

export interface SchemeData {
  id: string;
  name: string;
  description: string;
  cameraState: { position: number[]; target: number[] };
  filterState: { status: string[]; source: string[]; floor: number };
  pointStates: Record<string, { status: string; remark: string }>;
  screenshot?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InspectionPhoto {
  id: string;
  name: string;
  dataUrl: string;
  ocrText?: string;
  annotatedPoints?: { x: number; y: number; pointId: string }[];
  exif?: Record<string, string>;
  uploadedAt: string;
}

export interface StoreState {
  points: PointData[];
  photos: InspectionPhoto[];
  schemes: SchemeData[];
  selectedPointId: string | null;
  activeFloor: number;
  filterStatus: string[];
  filterSource: string[];
  cameraPosition: number[];
  cameraTarget: number[];
  showCrossFloorLinks: boolean;
  panelTab: 'trace' | 'anomaly' | 'scheme';
}

export interface StoreActions {
  setSelectedPoint: (id: string | null) => void;
  setActiveFloor: (floor: number) => void;
  toggleFilterStatus: (status: string) => void;
  toggleFilterSource: (source: string) => void;
  setCameraState: (position: number[], target: number[]) => void;
  addProcessRecord: (pointId: string, record: Omit<ProcessRecord, 'id' | 'timestamp'>) => void;
  resolveConflict: (pointId: string, resolution: 'use_system' | 'use_photo' | 'manual', remark: string) => void;
  updatePointStatus: (pointId: string, status: PointData['status']) => void;
  saveScheme: (name: string, description: string, screenshot?: string) => void;
  loadScheme: (schemeId: string) => void;
  deleteScheme: (schemeId: string) => void;
  setPanelTab: (tab: 'trace' | 'anomaly' | 'scheme') => void;
  toggleCrossFloorLinks: () => void;
  exportScreenshot: () => string | null;
  exportReport: () => string;
}

export type AppStore = StoreState & StoreActions;
