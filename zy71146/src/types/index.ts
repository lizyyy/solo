export type Vector3Tuple = [number, number, number];

export type ElementType = 'column' | 'signage' | 'store' | 'path' | 'barrier';

export type BlindSpotType = 'occlusion' | 'missing_sign' | 'temporary_barrier';

export type Severity = 'low' | 'medium' | 'high';

export type CameraMode = 'orbit' | 'firstPerson';

export type ToolType = 'select' | 'measure' | 'annotate';

export interface SceneElement {
  id: string;
  type: ElementType;
  position: Vector3Tuple;
  rotation?: Vector3Tuple;
  scale?: Vector3Tuple;
  name: string;
  visible: boolean;
}

export interface Column extends SceneElement {
  type: 'column';
  radius: number;
  height: number;
}

export interface Signage extends SceneElement {
  type: 'signage';
  direction: 'left' | 'right' | 'forward' | 'back';
  targetArea: string;
  text: string;
  isVisible?: boolean;
}

export interface Store extends SceneElement {
  type: 'store';
  storeName: string;
  category: string;
  width: number;
  depth: number;
}

export interface Barrier extends SceneElement {
  type: 'barrier';
  width: number;
  height: number;
  isTemporary: boolean;
}

export interface Path extends SceneElement {
  type: 'path';
  points: Vector3Tuple[];
  color: string;
}

export interface BlindSpot {
  id: string;
  position: Vector3Tuple;
  type: BlindSpotType;
  severity: Severity;
  description: string;
  relatedElements: string[];
  timestamp?: number;
}

export interface PathData {
  id: string;
  name: string;
  points: Vector3Tuple[];
  timestamps: number[];
  color: string;
}

export interface SceneData {
  id: string;
  name: string;
  description: string;
  elements: SceneElement[];
  paths: PathData[];
  floorPlan: {
    width: number;
    height: number;
  };
}

export interface ReportSnapshot {
  timestamp: string;
  cameraPosition: Vector3Tuple;
  cameraRotation: Vector3Tuple;
  activeFilters: string[];
  timelinePosition: number;
  blindSpots: BlindSpot[];
  visibleElements: string[];
  sceneName: string;
  screenshot?: string;
}

export interface Filters {
  columns: boolean;
  signages: boolean;
  stores: boolean;
  barriers: boolean;
  paths: boolean;
}

export interface VisibilityResult {
  signageId: string;
  isVisible: boolean;
  occlusionBy?: string;
  viewAngle?: number;
  distance?: number;
}
