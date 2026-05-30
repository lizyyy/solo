export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface SwingFrame {
  frameId: string;
  timestamp: number;
  position: Vector3;
  faceAngle: Vector3;
  velocity: number;
  acceleration: number;
  isSupplemented?: boolean;
  supplementId?: string;
}

export interface ImpactPoint {
  position: Vector3;
  faceAngle: number;
  velocity: number;
  isSupplemented?: boolean;
}

export type SupplementFieldType = 'trajectory' | 'velocity' | 'faceAngle' | 'impactPoint' | 'note' | 'attachment';
export type SupplementSource = 'manual' | 'file' | 'voice';

export interface SupplementRecord {
  supplementId: string;
  fieldType: SupplementFieldType;
  source: SupplementSource;
  supplementedAt: Date;
  supplementedBy: string;
  remark: string;
  affectedFrames: string[];
}

export type ChangeType = 'create' | 'update' | 'supplement' | 'import';

export interface DataVersion {
  versionId: string;
  versionNumber: number;
  changeType: ChangeType;
  changedBy: string;
  createdAt: Date;
  diffData: Record<string, any>;
  remark: string;
}

export type AnomalyType = 'jitter' | 'faceAngleReverse' | 'impactPointMissing' | 'dataGap';
export type Severity = 'low' | 'medium' | 'high';

export interface Anomaly {
  anomalyId: string;
  type: AnomalyType;
  severity: Severity;
  frameId?: string;
  frameRange?: { start: number; end: number };
  description: string;
  isConfirmed: boolean;
  isFalsePositive: boolean;
  detectedAt: Date;
  confirmedBy?: string;
  confirmedAt?: Date;
}

export interface Keyframe {
  keyframeId: string;
  frameId: string;
  label: string;
  color: string;
  note: string;
  createdAt: Date;
}

export type ImportResultType = 'new' | 'duplicate' | 'update' | 'conflict';
export type ConflictResolution = 'keep' | 'replace' | 'merge';

export interface ImportConflict {
  field: string;
  existingValue: any;
  newValue: any;
  resolution: ConflictResolution;
}

export interface ImportResult {
  resultType: ImportResultType;
  existingSessionId?: string;
  conflicts: ImportConflict[];
  updatedFields: string[];
}

export type SessionStatus = 'draft' | 'analyzing' | 'completed' | 'archived';

export interface SwingSession {
  sessionId: string;
  studentName: string;
  recordedAt: Date;
  importedAt: Date;
  importSource: string;
  dataFingerprint: string;
  dataCompleteness: number;
  frames: SwingFrame[];
  impactPoint?: ImpactPoint;
  metadata: Record<string, any>;
  supplements: SupplementRecord[];
  versions: DataVersion[];
  anomalies: Anomaly[];
  keyframes: Keyframe[];
  status: SessionStatus;
}

export type PanelType = 'params' | 'anomalies' | 'keyframes' | 'compare' | 'report' | 'supplement' | 'history';

export interface CameraState {
  position: Vector3;
  target: Vector3;
}

export interface SwingAnalysisState {
  currentSession: SwingSession | null;
  sessions: SwingSession[];
  selectedFrameIndex: number;
  isPlaying: boolean;
  playbackSpeed: number;
  cameraState: CameraState;
  showTrajectory: boolean;
  showClubHead: boolean;
  showImpactPoint: boolean;
  showGrid: boolean;
  selectedObjectId: string | null;
  selectedAnomalyId: string | null;
  selectedKeyframeId: string | null;
  activePanel: PanelType;
  showAlertBar: boolean;
}

export interface SwingAnalysisActions {
  setCurrentSession: (session: SwingSession | null) => void;
  updateSession: (updates: Partial<SwingSession>) => void;
  setSelectedFrame: (index: number | ((prev: number) => number)) => void;
  setPlaying: (playing: boolean) => void;
  setPlaybackSpeed: (speed: number) => void;
  updateParameter: (frameIndex: number, param: string, value: any) => void;
  supplementData: (supplement: Omit<SupplementRecord, 'supplementId' | 'supplementedAt'>) => void;
  detectAnomalies: () => void;
  confirmAnomaly: (anomalyId: string, confirmed: boolean) => void;
  addKeyframe: (keyframe: Omit<Keyframe, 'keyframeId' | 'createdAt'>) => void;
  importData: (data: any) => Promise<ImportResult>;
  resolveConflict: (conflict: ImportConflict, resolution: 'keep' | 'replace') => void;
  saveSession: () => void;
  exportReport: (format: 'pdf' | 'png') => Promise<void>;
  loadSessions: () => void;
  setSelectedObject: (id: string | null) => void;
  flyToFrame: (frameIndex: number) => void;
  setCameraState: (state: Partial<CameraState>) => void;
  setShowTrajectory: (show: boolean) => void;
  setShowClubHead: (show: boolean) => void;
  setShowImpactPoint: (show: boolean) => void;
  setShowGrid: (show: boolean) => void;
  setActivePanel: (panel: PanelType) => void;
  setShowAlertBar: (show: boolean) => void;
  setSelectedAnomalyId: (id: string | null) => void;
  setSelectedKeyframeId: (id: string | null) => void;
}

export type SwingAnalysisStore = SwingAnalysisState & SwingAnalysisActions;
