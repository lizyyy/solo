export type ElementType = 'cabinet' | 'entrance' | 'exit' | 'interactive_screen' | 'fire_exit';

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface Rotation {
  x: number;
  y: number;
  z: number;
}

export interface Scale {
  x: number;
  y: number;
  z: number;
}

export interface BaseElement {
  id: string;
  type: ElementType;
  name: string;
  position: Position;
  rotation: Rotation;
  scale: Scale;
  color?: string;
}

export interface Cabinet extends BaseElement {
  type: 'cabinet';
  description?: string;
  visibility?: number;
}

export interface Entrance extends BaseElement {
  type: 'entrance';
  flowDirection?: number;
  maxCapacity?: number;
}

export interface Exit extends BaseElement {
  type: 'exit';
  flowDirection?: number;
  maxCapacity?: number;
}

export interface InteractiveScreen extends BaseElement {
  type: 'interactive_screen';
  screenContent?: string;
}

export interface FireExit extends BaseElement {
  type: 'fire_exit';
  width?: number;
  minimumRequiredWidth?: number;
}

export type LayoutElement = Cabinet | Entrance | Exit | InteractiveScreen | FireExit;

export interface ExhibitionHall {
  id: string;
  name: string;
  width: number;
  depth: number;
  height: number;
  walls: Wall[];
  color: string;
}

export interface Wall {
  id: string;
  name: string;
  position: Position;
  rotation: Rotation;
  scale: Scale;
  isOuterWall: boolean;
}

export interface LayoutModel {
  hall: ExhibitionHall;
  elements: LayoutElement[];
}

export interface HeatZone {
  position: Position;
  intensity: number;
  radius: number;
  reason: string;
}

export interface VisionOcclusion {
  elementId: string;
  elementName: string;
  occludedBy: string;
  occludedByName: string;
  occlusionPercentage: number;
}

export interface FireExitIssue {
  elementId: string;
  elementName: string;
  issue: 'width_insufficient' | 'blocked';
  details: string;
}

export interface EntranceExitConflict {
  entranceId: string;
  entranceName: string;
  exitId: string;
  exitName: string;
  distance: number;
  minimumRequiredDistance: number;
}

export interface DetectionResult {
  heatZones: HeatZone[];
  visionOcclusions: VisionOcclusion[];
  fireExitIssues: FireExitIssue[];
  entranceExitConflicts: EntranceExitConflict[];
  totalIssues: number;
}
