export type SourceType = 'GIS' | 'TABLET' | 'EXCEL' | 'SCREENSHOT';

export type StatusType = 'NORMAL' | 'WARNING' | 'CONFIRM' | 'HISTORY' | 'ERROR' | 'DUPLICATE' | 'BOUNDARY';

export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface SourceInfo {
  type: SourceType;
  name: string;
  reference: string;
  rawData?: string;
}

export interface HistoryNote {
  id: string;
  date: string;
  author: string;
  content: string;
  source: string;
}

export interface Drone {
  id: string;
  name: string;
  position: Position3D;
  status: StatusType;
  obstacleDistance: number;
  source: SourceInfo;
  currentNote: string;
  historyNotes: HistoryNote[];
  createdAt: string;
  updatedAt: string;
  isDuplicate?: boolean;
  duplicateOf?: string;
  isBoundary?: boolean;
}

export interface Obstacle {
  id: string;
  name: string;
  position: Position3D;
  size: Position3D;
  source: SourceInfo;
}

export interface AvoidPath {
  id: string;
  droneId: string;
  points: Position3D[];
}

export interface Scheme {
  id: string;
  name: string;
  description: string;
  drones: Drone[];
  obstacles: Obstacle[];
  createdAt: string;
  updatedAt: string;
  author: string;
  cameraState?: {
    position: Position3D;
    target: Position3D;
  };
}

export interface ImportPreviewItem {
  drone: Drone;
  issues: string[];
  isEmpty: boolean;
  isDuplicate: boolean;
  isBoundary: boolean;
}

export const STATUS_COLORS: Record<StatusType, string> = {
  NORMAL: '#43A047',
  WARNING: '#FB8C00',
  CONFIRM: '#FF9800',
  HISTORY: '#78909C',
  ERROR: '#E53935',
  DUPLICATE: '#9C27B0',
  BOUNDARY: '#F44336',
};

export const STATUS_LABELS: Record<StatusType, string> = {
  NORMAL: '正常',
  WARNING: '预警',
  CONFIRM: '待人工确认',
  HISTORY: '历史口径',
  ERROR: '数据错误',
  DUPLICATE: '重复项',
  BOUNDARY: '边界异常',
};

export const SOURCE_LABELS: Record<SourceType, string> = {
  GIS: 'GIS图层',
  TABLET: '巡检平板',
  EXCEL: '临时Excel',
  SCREENSHOT: '周会截图',
};

export const SOURCE_COLORS: Record<SourceType, string> = {
  GIS: '#1E88E5',
  TABLET: '#00897B',
  EXCEL: '#7CB342',
  SCREENSHOT: '#8E24AA',
};
