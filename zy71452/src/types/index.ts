export interface SourceInfo {
  sourceId: string;
  fileName: string;
  importedAt: Date;
  sourceType: 'original' | 'processed';
  processingHistory?: {
    operation: string;
    timestamp: Date;
    operator?: string;
  }[];
}

export interface Node {
  id: string;
  x: number;
  y: number;
  z: number;
  _source: SourceInfo;
  metadata?: Record<string, unknown>;
}

export interface Element {
  id: string;
  nodeStartId: string;
  nodeEndId: string;
  type: 'beam' | 'pier' | 'deck';
  _source: SourceInfo;
}

export interface ModeShape {
  order: number;
  frequency: number;
  frequencyUnit: 'Hz' | 'rad/s';
  displacements: Record<string, { x: number; y: number; z: number }>;
  _source: SourceInfo;
}

export interface LoadCase {
  id: string;
  name: string;
  magnitude: number;
  positionX: number;
  lane: number;
  _source: SourceInfo;
}

export interface DataSource {
  id: string;
  fileName: string;
  fileType: string;
  importedAt: Date;
  sourceType: 'original' | 'processed';
}

export type ValidationErrorType = 'node_connection' | 'frequency_unit' | 'load_boundary';

export interface ValidationError {
  id: string;
  type: ValidationErrorType;
  severity: 'error' | 'warning';
  sourceId: string;
  sourceFileName: string;
  location: {
    nodeId?: string;
    elementId?: string;
    lineNumber?: number;
  };
  message: string;
  suggestion: string;
  humanReason: string;
}

export interface BridgeModel {
  id: string;
  name: string;
  nodes: Node[];
  elements: Element[];
  modeShapes: ModeShape[];
  length: number;
  _source: SourceInfo;
}

export interface SceneState {
  isPlaying: boolean;
  animationSpeed: number;
  deformationScale: number;
  selectedNodeId: string | null;
  selectedElementId: string | null;
  cameraTarget: [number, number, number];
}

export interface ModeShapeState {
  currentOrder: number;
  availableModes: number[];
  frequencyUnit: 'Hz' | 'rad/s';
}

export interface LoadState {
  magnitude: number;
  position: number;
  lane: number;
  isVisible: boolean;
}

export interface BridgeState {
  model: BridgeModel | null;
  scene: SceneState;
  modeShape: ModeShapeState;
  load: LoadState;
  dataSources: DataSource[];
  validationErrors: ValidationError[];
}

export interface BridgeActions {
  selectMode: (order: number) => void;
  setLoad: (params: Partial<LoadState>) => void;
  setScene: (params: Partial<SceneState>) => void;
  selectNode: (nodeId: string | null) => void;
  selectElement: (elementId: string | null) => void;
  importData: (file: File, sourceType: 'original' | 'processed') => Promise<void>;
  takeScreenshot: () => void;
  locateError: (errorId: string) => void;
  togglePlay: () => void;
  setFrequencyUnit: (unit: 'Hz' | 'rad/s') => void;
  clearErrors: () => void;
}
