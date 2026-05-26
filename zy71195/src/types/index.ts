export interface Container {
  id: string;
  containerNo: string;
  licensePlate: string;
  hasDangerous: boolean;
  dangerousLevel?: number;
}

export interface Reservation {
  id: string;
  containerNo: string;
  licensePlate: string;
  isValid: boolean;
  expireTime: number;
  allowDangerous: boolean;
}

export interface Vehicle {
  id: string;
  container: Container;
  reservation: Reservation;
  arriveTime: number;
  shouldIntercept: boolean;
  interceptionReason?: string;
}

export interface InspectionRecord {
  vehicleId: string;
  containerNo: string;
  licensePlate: string;
  hasDangerous: boolean;
  playerAction: 'pass' | 'intercept' | 'timeout';
  isCorrect: boolean;
  errorReason?: string;
  scoreChange: number;
  timestamp: number;
  timeSpent: number;
}

export interface GameState {
  level: Level;
  status: 'idle' | 'playing' | 'paused' | 'finished';
  currentVehicle: Vehicle | null;
  queue: Vehicle[];
  score: number;
  processedCount: number;
  correctCount: number;
  records: InspectionRecord[];
  startTime: number;
  pauseTime: number;
  vehicleStartTime: number;
}

export interface Level {
  id: number;
  name: string;
  description: string;
  vehicleCount: number;
  timePerVehicle: number;
  dangerousRate: number;
  mismatchRate: number;
  maxQueueSize: number;
  passScore: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
}

export interface GameHistory {
  id: string;
  levelId: number;
  levelName: string;
  score: number;
  accuracy: number;
  totalVehicles: number;
  correctCount: number;
  errorCount: number;
  records: InspectionRecord[];
  startTime: number;
  endTime: number;
  duration: number;
}

export interface ValidationResult {
  isCorrect: boolean;
  errorReason?: string;
  scoreChange: number;
}
