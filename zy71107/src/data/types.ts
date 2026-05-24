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

export interface Wall {
  id: string;
  start: Position3D;
  end: Position3D;
  height: number;
}

export interface Showcase {
  id: string;
  number: string;
  name: string;
  position: Position3D;
  size: Size3D;
  category: string;
}

export interface ExhibitionHall {
  id: string;
  name: string;
  dimensions: Size3D;
  showcases: Showcase[];
  walls: Wall[];
}

export interface TrajectoryPoint {
  timestamp: number;
  position: Position3D;
  confidence: number;
}

export interface StayRecord {
  showcaseId: string;
  startTime: number;
  duration: number;
  isCongestion: boolean;
}

export interface VisitorTrajectory {
  visitorId: string;
  batchId: string;
  startTime: number;
  endTime: number;
  points: TrajectoryPoint[];
  stays: StayRecord[];
}

export interface BatchData {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  visitorCount: number;
}

export type AnomalyType = 'trajectory_break' | 'showcase_mismatch' | 'congestion_confusion';
export type AnomalySeverity = 'low' | 'medium' | 'high';

export interface AnomalyReport {
  type: AnomalyType;
  severity: AnomalySeverity;
  message: string;
  location?: Position3D;
  visitorId?: string;
  showcaseId?: string;
}

export type CameraView = 'top' | 'perspective' | 'front' | 'side';
export type SampleType = 'normal' | 'conflict' | 'empty';

export interface SceneState {
  hallData: ExhibitionHall | null;
  trajectories: VisitorTrajectory[];
  batches: BatchData[];
  anomalies: AnomalyReport[];
  
  isPlaying: boolean;
  currentTime: number;
  playbackSpeed: number;
  totalDuration: number;
  
  selectedBatch: string | null;
  selectedShowcases: string[];
  showHeatmap: boolean;
  showTrajectories: boolean;
  highlightAnomalies: boolean;
  
  cameraView: CameraView;
  selectedShowcase: string | null;
  selectedVisitor: string | null;
  
  currentSample: SampleType | null;
}

export interface SceneActions {
  setHallData: (data: ExhibitionHall | null) => void;
  setTrajectories: (data: VisitorTrajectory[]) => void;
  setBatches: (data: BatchData[]) => void;
  setAnomalies: (data: AnomalyReport[]) => void;
  
  setPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number | ((prev: number) => number)) => void;
  setPlaybackSpeed: (speed: number) => void;
  setTotalDuration: (duration: number) => void;
  
  setSelectedBatch: (batchId: string | null) => void;
  toggleShowcase: (showcaseId: string) => void;
  setShowHeatmap: (show: boolean) => void;
  setShowTrajectories: (show: boolean) => void;
  setHighlightAnomalies: (highlight: boolean) => void;
  
  setCameraView: (view: CameraView) => void;
  setSelectedShowcase: (showcaseId: string | null) => void;
  setSelectedVisitor: (visitorId: string | null) => void;
  
  loadSample: (type: SampleType) => void;
  resetState: () => void;
}
