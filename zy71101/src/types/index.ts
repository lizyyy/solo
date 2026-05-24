export interface Point3D {
  x: number;
  y: number;
  z: number;
  unit: 'meter' | 'feet';
}

export interface Building {
  id: string;
  name: string;
  position: Point3D;
  width: number;
  depth: number;
  height: number;
  color: string;
}

export interface NoFlyZone {
  id: string;
  name: string;
  type: 'polygon' | 'circle';
  coordinates: Point3D[];
  radius?: number;
  minHeight: number;
  maxHeight: number;
  color: string;
}

export interface Waypoint {
  id: string;
  position: Point3D;
  speed: number;
  stayTime: number;
}

export interface FlightPath {
  id: string;
  name: string;
  waypoints: Waypoint[];
  color: string;
}

export interface BatteryPoint {
  time: number;
  percentage: number;
  distance: number;
  altitude: number;
}

export interface Alert {
  id: string;
  type: 'collision' | 'battery' | 'height_unit';
  severity: 'warning' | 'danger';
  message: string;
  time?: number;
  position?: Point3D;
}

export interface Mission {
  id: string;
  name: string;
  description: string;
  buildings: Building[];
  noFlyZones: NoFlyZone[];
  flightPaths: FlightPath[];
  batteryCurve: BatteryPoint[];
  createdAt: string;
}

export interface CameraState {
  position: [number, number, number];
  target: [number, number, number];
}

export interface AppState {
  currentMission: Mission | null;
  selectedWaypoint: string | null;
  isPlaying: boolean;
  currentTime: number;
  totalDuration: number;
  playbackSpeed: number;
  cameraView: 'orbit' | 'firstPerson' | 'topDown';
  cameraState: CameraState;
  filters: {
    showBuildings: boolean;
    showNoFlyZones: boolean;
    showFlightPath: boolean;
    showBatteryCurve: boolean;
  };
  alerts: Alert[];
  dronePosition: Point3D | null;
}

export interface AppActions {
  setCurrentMission: (mission: Mission | null) => void;
  setSelectedWaypoint: (id: string | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  setCameraView: (view: 'orbit' | 'firstPerson' | 'topDown') => void;
  setCameraState: (state: CameraState) => void;
  setFilters: (filters: Partial<AppState['filters']>) => void;
  addAlert: (alert: Omit<Alert, 'id'>) => void;
  clearAlerts: () => void;
  updateWaypoint: (id: string, position: Point3D) => void;
  setDronePosition: (position: Point3D | null) => void;
  resetState: () => void;
}

export type AppStore = AppState & AppActions;

export const unitConversion = {
  toMeters: (value: number, unit: 'meter' | 'feet'): number => {
    return unit === 'feet' ? value * 0.3048 : value;
  },
  toFeet: (value: number, unit: 'meter' | 'feet'): number => {
    return unit === 'meter' ? value * 3.28084 : value;
  },
  convert: (value: number, from: 'meter' | 'feet', to: 'meter' | 'feet'): number => {
    if (from === to) return value;
    return from === 'meter' ? value * 3.28084 : value * 0.3048;
  }
};
