export type DrumPieceType = 'snare' | 'kick' | 'tom1' | 'tom2' | 'floorTom' | 'hihat' | 'crash' | 'ride';

export type PolarPattern = 'cardioid' | 'omnidirectional' | 'bidirectional' | 'figure8';

export type DistanceUnit = 'cm' | 'm' | 'inch';

export type Severity = 'error' | 'warning' | 'info';

export type ErrorCategory = 'phase' | 'distance' | 'occlusion' | 'format' | 'unit';

export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface Rotation3D {
  x: number;
  y: number;
  z: number;
}

export interface DrumPiece {
  id: string;
  type: DrumPieceType;
  name: string;
  position: Position3D;
  rotationY: number;
  size: string;
  notes?: string;
}

export interface Microphone {
  id: string;
  drumPieceId: string;
  name: string;
  model?: string;
  position: Position3D;
  rotation: Rotation3D;
  polarPattern: PolarPattern;
  phaseInverted: boolean;
  distanceUnit: DistanceUnit;
  gain: number;
  notes?: string;
}

export interface PhaseRelation {
  mic1Id: string;
  mic2Id: string;
  phaseDiff: number;
  isCoherent: boolean;
  correlation: number;
}

export interface CrosstalkData {
  sourceMicId: string;
  targetMicId: string;
  level: number;
  frequency: string;
}

export interface ValidationError {
  id: string;
  severity: Severity;
  category: ErrorCategory;
  field?: string;
  message: string;
  suggestion: string;
  sourceId?: string;
}

export interface Session {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  drumPieces: DrumPiece[];
  microphones: Microphone[];
  recordingNotes?: string;
}

export interface AcousticAnalysis {
  phaseRelations: PhaseRelation[];
  crosstalkMatrix: CrosstalkData[];
  distanceMatrix: Record<string, number>;
  errors: ValidationError[];
}

export interface SavedSession {
  id: string;
  name: string;
  createdAt: string;
  session: Session;
  thumbnail?: string;
}

export interface DrumKitStore {
  session: Session;
  selectedMicId: string | null;
  selectedDrumId: string | null;
  analysis: AcousticAnalysis;
  isLoading: boolean;
  showCrosstalk: boolean;
  showPhaseLines: boolean;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
}
