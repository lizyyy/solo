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

export interface Seat {
  id: string;
  row: number;
  col: number;
  position: Position3D;
  isBlocked: boolean;
  isSelected: boolean;
  isVisible: boolean;
  blockingObstacleId?: string;
}

export type ObstacleType = 'pillar' | 'projector' | 'screen';

export interface Obstacle {
  id: string;
  type: ObstacleType;
  position: Position3D;
  size: Size3D;
}

export interface Platform {
  position: Position3D;
  size: Size3D;
  targetPoint: Position3D;
}

export interface LineOfSightResult {
  seatId: string;
  isBlocked: boolean;
  blockingObstacleId?: string;
  hitPoint?: Position3D;
}

export interface TimelineState {
  id: string;
  name: string;
  seats: Seat[];
  timestamp: number;
}

export interface ClassroomLayout {
  name: string;
  seats: Seat[];
  obstacles: Obstacle[];
  platform: Platform;
  eyeHeight: number;
}

export interface ExportReport {
  generatedAt: string;
  cameraPosition: Position3D;
  filters: {
    rows: number[];
    blockedOnly: boolean;
  };
  timelinePosition: number;
  totalSeats: number;
  blockedSeats: number;
  blockedSeatIds: string[];
  layoutName: string;
  screenshot?: string;
}

export type ViewMode = 'perspective' | 'top' | 'front' | 'side';

export interface AppState {
  layoutName: string;
  seats: Seat[];
  obstacles: Obstacle[];
  platform: Platform;
  eyeHeight: number;
  selectedSeatId: string | null;
  isDraggingEnabled: boolean;
  filters: {
    rows: number[];
    blockedOnly: boolean;
  };
  viewMode: ViewMode;
  timelineStates: TimelineState[];
  currentTimelineIndex: number;
  showLineOfSight: boolean;
}

export interface AppActions {
  setSeats: (seats: Seat[]) => void;
  updateSeatPosition: (seatId: string, position: Position3D) => void;
  toggleSeatSelection: (seatId: string) => void;
  setSelectedSeat: (seatId: string | null) => void;
  setIsDraggingEnabled: (enabled: boolean) => void;
  addSeatRow: () => void;
  setFilters: (filters: { rows: number[]; blockedOnly: boolean }) => void;
  setViewMode: (mode: ViewMode) => void;
  setEyeHeight: (height: number) => void;
  saveTimelineState: (name: string) => void;
  setTimelineIndex: (index: number) => void;
  setShowLineOfSight: (show: boolean) => void;
  loadLayout: (layout: ClassroomLayout) => void;
  resetLayout: () => void;
  updateLineOfSightResults: (results: LineOfSightResult[]) => void;
}
