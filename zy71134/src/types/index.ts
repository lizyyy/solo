export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface Size3D {
  width: number;
  height: number;
  depth: number;
}

export interface Floor {
  id: string;
  name: string;
  level: number;
}

export interface Ward {
  id: string;
  name: string;
  floorId: string;
  position: Position3D;
  size: Size3D;
  color: string;
}

export interface Pipeline {
  id: string;
  name: string;
  floorId: string;
  path: Position3D[];
  status: 'normal' | 'maintenance' | 'fault';
  connectedValves: string[];
}

export interface Valve {
  id: string;
  name: string;
  floorId: string;
  pipelineId: string;
  position: Position3D;
  isOpen: boolean;
  status: 'normal' | 'maintenance' | 'fault' | 'expired';
  maintenanceDate?: string;
  expiryDate?: string;
  affectedWards: string[];
  description: string;
}

export interface TimelineState {
  currentTime: Date;
  speed: number;
  isPlaying: boolean;
}

export type CameraViewType = 'perspective' | 'top' | 'front' | 'side';
export type FilterStatusType = 'normal' | 'maintenance' | 'fault' | 'expired';

export interface OperationLog {
  id: string;
  timestamp: Date;
  valveId: string;
  valveName: string;
  action: 'open' | 'close';
  user: string;
}

export interface AppState {
  floors: Floor[];
  wards: Ward[];
  pipelines: Pipeline[];
  valves: Valve[];
  selectedFloorId: string | null;
  selectedValveId: string | null;
  filterStatus: FilterStatusType[];
  cameraView: CameraViewType;
  timeline: TimelineState;
  operationLogs: OperationLog[];
  showAffectedArea: boolean;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
}

export interface AppActions {
  setSelectedFloor: (floorId: string | null) => void;
  setSelectedValve: (valveId: string | null) => void;
  toggleValve: (valveId: string) => void;
  setFilterStatus: (status: FilterStatusType[]) => void;
  setCameraView: (view: CameraViewType) => void;
  setTimelineTime: (time: Date) => void;
  toggleTimelinePlay: () => void;
  resetState: () => void;
  importSampleData: () => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  toggleShowAffectedArea: () => void;
  addOperationLog: (valveId: string, valveName: string, action: 'open' | 'close') => void;
}

export type AppStore = AppState & AppActions;
