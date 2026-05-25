export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface Classroom {
  id: string;
  name: string;
  floor: number;
  grade: number;
  studentCount: number;
  position: Position;
  exitOrder: number;
  exitDelay: number;
  assignedStairId: string;
}

export interface Stair {
  id: string;
  name: string;
  floors: number[];
  capacity: number;
  currentCount: number;
  position: Position;
  isClosed: boolean;
  width: number;
  depth: number;
}

export interface AssemblyPoint {
  id: string;
  name: string;
  capacity: number;
  currentCount: number;
  position: Position;
  radius: number;
}

export interface Student {
  id: string;
  classroomId: string;
  status: 'waiting' | 'moving' | 'inStair' | 'queued' | 'arrived';
  position: Position;
  targetPosition: Position;
  path: Position[];
  currentPathIndex: number;
  speed: number;
  startTime: number;
  arrivalTime: number | null;
  queueTime?: number;
  rerouted?: boolean;
}

export interface BuildingConfig {
  floors: number;
  floorHeight: number;
  width: number;
  depth: number;
}

export interface EvacuationPlan {
  id: string;
  name: string;
  description: string;
  building: BuildingConfig;
  classrooms: Classroom[];
  stairs: Stair[];
  assemblyPoints: AssemblyPoint[];
  closedAreas: string[];
  type: 'normal' | 'conflict' | 'empty';
}

export interface Conflict {
  id: string;
  type: 'order' | 'stairCapacity' | 'assemblyCapacity';
  time: number;
  location: string;
  description: string;
  severity: 'warning' | 'critical';
  resolved: boolean;
}

export interface Statistics {
  totalStudents: number;
  evacuatedStudents: number;
  avgEvacuationTime: number;
  maxEvacuationTime: number;
  minEvacuationTime: number;
  maxStairUsage: number;
  conflictCount: number;
  stairUtilization: Record<string, number>;
  classroomCompletion: Record<string, number>;
  classroomQueueTime?: Record<string, number>;
  totalQueueLength?: number;
  blockageCount?: number;
}

export interface SimulationState {
  isPlaying: boolean;
  currentTime: number;
  speed: number;
  totalTime: number;
  students: Student[];
  conflicts: Conflict[];
  statistics: Statistics;
  selectedPlanId: string | null;
  cameraView: 'overview' | 'top' | 'front' | 'side' | 'free';
  showPaths: boolean;
  showLabels: boolean;
  floorOpacity: number;
}

export interface EvacuationReport {
  planName: string;
  generatedAt: string;
  totalTime: number;
  statistics: Statistics;
  conflicts: Conflict[];
  recommendations: string[];
}
