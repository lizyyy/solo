export type ArtifactType = 'pottery' | 'stone' | 'bone' | 'metal' | 'other';

export type ValidationErrorType = 'duplicate_id' | 'depth_conflict' | 'invalid_position' | 'layer_mismatch';

export interface SoilLayer {
  id: string;
  name: string;
  color: string;
  depthTop: number;
  depthBottom: number;
  period: string;
  description: string;
  visible: boolean;
}

export interface Artifact {
  id: string;
  artifactId: string;
  name: string;
  type: ArtifactType;
  position: { x: number; y: number; z: number };
  layerId: string;
  period: string;
  description: string;
  photoUrl?: string;
  selected: boolean;
  hasConflict?: boolean;
}

export interface ExcavationSquare {
  id: string;
  name: string;
  gridSize: { x: number; y: number; z: number };
  unit: 'cm' | 'm';
  layers: SoilLayer[];
  artifacts: Artifact[];
}

export interface FilterState {
  types: ArtifactType[];
  periods: string[];
  depthRange: [number, number];
  layerIds: string[];
}

export interface ValidationError {
  type: ValidationErrorType;
  artifactId?: string;
  layerId?: string;
  message: string;
}

export interface SampleDataset {
  id: string;
  name: string;
  description: string;
  data: ExcavationSquare;
  hasConflicts: boolean;
}

export interface TimelineState {
  isPlaying: boolean;
  currentPeriodIndex: number;
  speed: number;
}

export type CameraView = 'perspective' | 'top' | 'front' | 'side';
