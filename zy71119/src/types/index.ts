export type Orientation = 'north' | 'south' | 'east' | 'west';

export type Vector3Tuple = [number, number, number];

export interface Building {
  id: string;
  name: string;
  position: Vector3Tuple;
  dimensions: {
    width: number;
    height: number;
    depth: number;
  };
  floors: number;
  color: string;
}

export interface WindowUnit {
  id: string;
  buildingId: string;
  floor: number;
  unitNumber: string;
  position: Vector3Tuple;
  size: {
    width: number;
    height: number;
  };
  orientation: Orientation;
}

export interface SunPosition {
  azimuth: number;
  altitude: number;
  position: Vector3Tuple;
  direction: Vector3Tuple;
}

export interface ShadowRecord {
  windowId: string;
  buildingId: string;
  buildingName: string;
  startTime: number;
  endTime: number;
  duration: number;
}

export interface SolarTerm {
  name: string;
  date: string;
  altitude: number;
}

export interface ViewPreset {
  name: string;
  position: Vector3Tuple;
  target: Vector3Tuple;
}

export interface AppState {
  buildings: Building[];
  windows: WindowUnit[];
  currentDate: Date;
  currentTime: number;
  isPlaying: boolean;
  playSpeed: number;
  selectedWindows: string[];
  selectedBuildings: string[];
  highlightedBuilding: string | null;
  shadowRecords: ShadowRecord[];
  cameraPosition: Vector3Tuple;
  cameraTarget: Vector3Tuple;
  isDataLoaded: boolean;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  setDate: (date: Date) => void;
  setTime: (time: number) => void;
  togglePlay: () => void;
  setPlaySpeed: (speed: number) => void;
  selectWindow: (id: string, multiSelect?: boolean) => void;
  deselectWindow: (id: string) => void;
  clearSelectedWindows: () => void;
  highlightBuilding: (id: string | null) => void;
  setCameraPosition: (position: Vector3Tuple, target: Vector3Tuple) => void;
  loadSampleData: () => void;
  resetState: () => void;
  calculateShadows: () => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
}

export const SOLAR_TERMS: SolarTerm[] = [
  { name: '春分', date: '03-20', altitude: 60 },
  { name: '夏至', date: '06-21', altitude: 83 },
  { name: '秋分', date: '09-23', altitude: 60 },
  { name: '冬至', date: '12-22', altitude: 37 },
];

export const VIEW_PRESETS: ViewPreset[] = [
  { name: '俯视图', position: [0, 150, 0], target: [0, 0, 0] },
  { name: '正视图', position: [0, 30, 100], target: [0, 15, 0] },
  { name: '侧视图', position: [100, 30, 0], target: [0, 15, 0] },
  { name: '斜视图', position: [60, 50, 60], target: [0, 15, 0] },
];

export const formatTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

export const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours > 0) {
    return `${hours}小时${mins}分钟`;
  }
  return `${mins}分钟`;
};

export const getOrientationName = (orientation: Orientation): string => {
  const names: Record<Orientation, string> = {
    north: '北向',
    south: '南向',
    east: '东向',
    west: '西向',
  };
  return names[orientation];
};
