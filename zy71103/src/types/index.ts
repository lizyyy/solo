export type ElementType = 'instrumentCart' | 'sterileZone' | 'recycleBin' | 'staff';
export type StaffRole = 'nurse' | 'doctor' | 'anesthetist';
export type ErrorType = 'sterileCross' | 'collision' | 'routeCross';
export type ErrorSeverity = 'warning' | 'error';
export type EditMode = 'select' | 'translate' | 'rotate' | 'drawPath';
export type CameraView = 'top' | 'front' | 'side' | 'free';

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface BaseElement {
  id: string;
  type: ElementType;
  name: string;
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
}

export interface InstrumentCart extends BaseElement {
  type: 'instrumentCart';
  width: number;
  depth: number;
  height: number;
}

export interface SterileZone extends BaseElement {
  type: 'sterileZone';
  width: number;
  depth: number;
  color: string;
}

export interface RecycleBin extends BaseElement {
  type: 'recycleBin';
  radius: number;
}

export interface PathPoint {
  id: string;
  position: Vector3;
  timestamp: number;
  action?: string;
}

export interface Staff extends BaseElement {
  type: 'staff';
  role: StaffRole;
  path: PathPoint[];
  color: string;
}

export interface TimelineStep {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  description: string;
  staffId: string;
}

export interface ErrorItem {
  id: string;
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  position?: Vector3;
  timestamp?: number;
  elementIds: string[];
}

export interface SceneData {
  name: string;
  roomSize: { width: number; depth: number };
  elements: (InstrumentCart | SterileZone | RecycleBin | Staff)[];
  timeline: TimelineStep[];
  errors: ErrorItem[];
}

export interface AppState {
  sceneData: SceneData;
  selectedElementId: string | null;
  isPlaying: boolean;
  currentTime: number;
  totalDuration: number;
  editMode: EditMode;
  cameraView: CameraView;
  hoveredElementId: string | null;

  setSelectedElement: (id: string | null) => void;
  setHoveredElement: (id: string | null) => void;
  updateElement: (id: string, updates: Partial<BaseElement>) => void;
  addElement: (element: BaseElement) => void;
  removeElement: (id: string) => void;
  addPathPoint: (staffId: string, point: PathPoint) => void;
  removePathPoint: (staffId: string, pointId: string) => void;
  updatePathPoint: (staffId: string, pointId: string, updates: Partial<PathPoint>) => void;
  setPlayState: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setEditMode: (mode: EditMode) => void;
  setCameraView: (view: CameraView) => void;
  loadSample: (sampleId: string) => void;
  resetScene: () => void;
  exportReport: () => void;
  detectErrors: () => void;
  addTimelineStep: (step: TimelineStep) => void;
  removeTimelineStep: (stepId: string) => void;
}

export type SceneElement = InstrumentCart | SterileZone | RecycleBin | Staff;
