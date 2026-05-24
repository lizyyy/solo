
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Dimensions {
  width: number;
  height: number;
  depth: number;
}

export interface LiftingPoint {
  id: string;
  position: Vector3;
  direction: Vector3;
  isValid: boolean;
}

export interface Block {
  id: string;
  name: string;
  position: Vector3;
  rotation: Vector3;
  dimensions: Dimensions;
  liftingPoints: LiftingPoint[];
  color: string;
  startPosition: Vector3;
  endPosition: Vector3;
}

export interface Pier {
  id: string;
  name: string;
  position: Vector3;
  dimensions: Dimensions;
}

export interface GantryRail {
  id: string;
  start: Vector3;
  end: Vector3;
  width: number;
}

export interface LiftingPath {
  id: string;
  blockId: string;
  waypoints: Vector3[];
  duration: number;
}

export type CollisionType = 'pier' | 'rail' | 'liftingPoint' | 'path';
export type CollisionSeverity = 'warning' | 'error';

export interface CollisionResult {
  id: string;
  type: CollisionType;
  severity: CollisionSeverity;
  message: string;
  position?: Vector3;
  blockId?: string;
  pierId?: string;
}

export type SampleType = 'normal' | 'conflict' | 'empty';

export interface SceneData {
  blocks: Block[];
  piers: Pier[];
  rails: GantryRail[];
  liftingPaths: LiftingPath[];
}

export interface VisibilityState {
  blocks: boolean;
  piers: boolean;
  rails: boolean;
  liftingPoints: boolean;
  liftingPaths: boolean;
  collisionMarkers: boolean;
}

export interface CameraView {
  position: Vector3;
  target: Vector3;
}

export interface AppState {
  currentSample: SampleType;
  sceneData: SceneData;
  collisions: CollisionResult[];
  timelineProgress: number;
  isPlaying: boolean;
  selectedBlockId: string | null;
  visibility: VisibilityState;
  cameraView: CameraView;
  showComparison: boolean;
  comparisonSample: SampleType | null;
}

export interface AppActions {
  setCurrentSample: (sample: SampleType) => void;
  setTimelineProgress: (progress: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setSelectedBlockId: (id: string | null) => void;
  setVisibility: (visibility: Partial<VisibilityState>) => void;
  setCameraView: (view: CameraView) => void;
  resetScene: () => void;
  toggleComparison: (show: boolean) => void;
  setComparisonSample: (sample: SampleType | null) => void;
  updateBlockPosition: (blockId: string, position: Vector3) => void;
  checkCollisions: () => void;
}

