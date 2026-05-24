export type EsiLevel = 1 | 2 | 3 | 4 | 5;

export type PatientStatus = 'waiting' | 'processing' | 'discharged' | 'deceased' | 'reassess';

export type RoomStatus = 'idle' | 'occupied' | 'cleaning';

export type GameStatus = 'playing' | 'paused' | 'won' | 'lost';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type ActionType = 
  | 'triage' 
  | 'assign_room' 
  | 'reassess' 
  | 'patient_arrive' 
  | 'patient_discharge' 
  | 'patient_death'
  | 'wrong_triage';

export type FailType = 'missed_critical' | 'wait_timeout' | 'wrong_triage' | 'resource_waste';

export interface VitalSigns {
  heartRate: number;
  bloodPressure: string;
  temperature: number;
  respiratoryRate: number;
  oxygenSaturation: number;
}

export interface ReassessEvent {
  triggerTime: number;
  newSymptoms: string[];
  newVitalSigns: Partial<VitalSigns>;
  newCorrectEsi: EsiLevel;
  triggered: boolean;
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: 'male' | 'female';
  chiefComplaint: string;
  symptoms: string[];
  vitalSigns: VitalSigns;
  correctEsi: EsiLevel;
  currentEsi: EsiLevel;
  arrivalTime: number;
  maxWaitTime: number;
  processingTime: number;
  status: PatientStatus;
  reassessEvents: ReassessEvent[];
  assignedRoomId?: string;
  triageDecision?: EsiLevel;
}

export interface Room {
  id: string;
  name: string;
  status: RoomStatus;
  patientId?: string;
  processingProgress: number;
  canHandleEsi: EsiLevel[];
}

export interface GameAction {
  timestamp: number;
  type: ActionType;
  patientId: string;
  details: Record<string, any>;
}

export interface FailReason {
  timestamp: number;
  type: FailType;
  patientId: string;
  description: string;
  penalty: number;
}

export interface PatientTemplate {
  id: string;
  name: string;
  age: number;
  gender: 'male' | 'female';
  chiefComplaint: string;
  symptoms: string[];
  vitalSigns: VitalSigns;
  correctEsi: EsiLevel;
  maxWaitTime: number;
  processingTime: number;
  reassessEvents: Omit<ReassessEvent, 'triggered'>[];
}

export interface RoomConfig {
  id: string;
  name: string;
  canHandleEsi: EsiLevel[];
}

export interface LevelConfig {
  id: string;
  name: string;
  description: string;
  difficulty: Difficulty;
  patientSpawnRate: number;
  targetPatients: number;
  rooms: RoomConfig[];
  patientPool: string[];
  initialPatients: number;
}

export interface GameState {
  id: string;
  levelId: string;
  status: GameStatus;
  score: number;
  timeElapsed: number;
  patients: Patient[];
  rooms: Room[];
  actionHistory: GameAction[];
  failReasons: FailReason[];
  patientsProcessed: number;
  targetPatients: number;
  patientSpawnRate: number;
  lastSpawnTime: number;
}

export interface GameRecord {
  id: string;
  levelId: string;
  levelName: string;
  score: number;
  status: GameStatus;
  patientsProcessed: number;
  targetPatients: number;
  timestamp: number;
  duration: number;
  failReasons: FailReason[];
  actionHistory: GameAction[];
}
