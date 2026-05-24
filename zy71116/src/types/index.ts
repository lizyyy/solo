export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface CameraState {
  position: Vector3;
  target: Vector3;
  fov: number;
}

export interface FilterState {
  maxSlope: number;
  avoidConstruction: boolean;
  preferElevator: boolean;
  showRamps: boolean;
  showElevators: boolean;
  showConstructions: boolean;
}

export type FacilityType = 'ramp' | 'elevator' | 'doorway' | 'path';
export type FacilityStatus = 'active' | 'maintenance' | 'disabled';

export interface Facility {
  id: string;
  name: string;
  type: FacilityType;
  position: Vector3;
  path: Vector3[];
  slope: number;
  status: FacilityStatus;
  floor?: number;
}

export interface Construction {
  id: string;
  name: string;
  position: Vector3;
  size: Vector3;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export type BuildingType = 'dorm' | 'teaching' | 'canteen' | 'library' | 'other';

export interface Building {
  id: string;
  name: string;
  type: BuildingType;
  position: Vector3;
  size: Vector3;
  color: string;
}

export type WaypointType = 'normal' | 'ramp' | 'elevator' | 'entrance';

export interface Waypoint {
  id: string;
  position: Vector3;
  type: WaypointType;
  facilityId?: string;
  slope: number;
  instruction?: string;
}

export interface RouteValidation {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  maxSlope: number;
  elevatorCount: number;
  constructionBlocks: string[];
}

export interface Route {
  id: string;
  startPoint: string;
  endPoint: string;
  waypoints: Waypoint[];
  totalDistance: number;
  estimatedTime: number;
  validation: RouteValidation;
}

export interface RouteReport {
  id: string;
  exportTime: string;
  route: Route;
  cameraState: CameraState;
  filters: FilterState;
  timelinePosition: number;
  screenshot?: string;
}

export interface PointOfInterest {
  id: string;
  name: string;
  position: Vector3;
  type: 'start' | 'end';
}

export interface CampusData {
  id: string;
  name: string;
  version: string;
  buildings: Building[];
  facilities: Facility[];
  constructions: Construction[];
  startPoints: PointOfInterest[];
  endPoints: PointOfInterest[];
}

export interface AppState {
  campusData: CampusData | null;
  currentRoute: Route | null;
  selectedStartPoint: string | null;
  selectedEndPoint: string | null;
  filters: FilterState;
  cameraState: CameraState;
  timelinePosition: number;
  isPlaying: boolean;
  isLoading: boolean;
}
