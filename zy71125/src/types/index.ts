export type ContainerSize = '20ft' | '40ft';
export type ContainerStatus = 'normal' | 'target' | 'blocking' | 'moved';
export type CameraView = 'default' | 'top' | 'side' | 'gantry';
export type MoveType = 'relocation' | 'retrieval';

export interface Position {
  bay: number;
  row: number;
  tier: number;
}

export interface Container {
  id: string;
  bay: number;
  row: number;
  tier: number;
  size: ContainerSize;
  weight: number;
  status: ContainerStatus;
  color: string;
}

export interface Yard {
  id: string;
  name: string;
  bays: number;
  rows: number;
  maxTiers: number;
  gantryPositions: number[];
}

export interface Move {
  step: number;
  type: MoveType;
  containerId: string;
  from: Position;
  to: Position | null;
}

export interface Task {
  id: string;
  targetContainerId: string;
  moves: Move[];
  totalRelocations: number;
  optimalSide: 'left' | 'right';
  createdAt: number;
}

export interface AppState {
  containers: Container[];
  yard: Yard | null;
  selectedContainerId: string | null;
  currentTask: Task | null;
  filter: {
    bay: number | null;
    search: string;
  };
  timeline: {
    currentStep: number;
    isPlaying: boolean;
    speed: number;
  };
  cameraView: CameraView;
}

export interface AccessibilityResult {
  targetContainer: Container;
  blockingContainers: Container[];
  layersAbove: number;
  leftSideAccessible: boolean;
  rightSideAccessible: boolean;
  optimalSide: 'left' | 'right';
  minRelocations: number;
  moves: Move[];
}
