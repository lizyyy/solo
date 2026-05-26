export interface Medicine {
  id: string;
  name: string;
  genericName: string;
  specification: string;
  unit: string;
  batchNumber: string;
  expiryDate: string;
  manufacturer: string;
  category: string;
  contraindications: string[];
  drugInteractions: string[];
}

export interface PrescriptionItem {
  medicineId: string;
  medicineName: string;
  dosage: number;
  unit: string;
  frequency: string;
  duration: string;
  hasDosageError?: boolean;
  hasContraindication?: boolean;
  hasBatchError?: boolean;
}

export interface Prescription {
  id: string;
  patientName: string;
  patientAge: number;
  patientGender: '男' | '女';
  diagnosis: string;
  allergies: string[];
  items: PrescriptionItem[];
  doctorName: string;
  date: string;
}

export type GameActionType =
  | 'drag_start'
  | 'drag_end'
  | 'place'
  | 'remove'
  | 'check'
  | 'confirm'
  | 'error'
  | 'correct';

export type CheckType = 'dosage' | 'contraindication' | 'batch';

export interface GameAction {
  timestamp: number;
  type: GameActionType;
  payload: {
    medicineId?: string;
    checkType?: CheckType;
    isCorrect?: boolean;
    errorType?: GameErrorType;
    details?: string;
  };
}

export type GameErrorType =
  | 'dosage_unit'
  | 'dosage_amount'
  | 'contraindication'
  | 'drug_interaction'
  | 'batch_expired'
  | 'wrong_medicine'
  | 'timeout'
  | 'unchecked_confirm'
  | 'repeated_operation'
  | 'dosage'
  | 'batch'
  | 'correct_reject'
  | 'wrong_reject';

export type ErrorSeverity = 'minor' | 'major' | 'critical';

export interface GameError {
  id: string;
  type: GameErrorType;
  severity: ErrorSeverity;
  description: string;
  correctAnswer: string;
  pointsDeducted: number;
  timestamp: number;
  medicineId: string;
  prescriptionId: string;
  message: string;
  penalty: number;
}

export interface PrescriptionResult {
  prescriptionId: string;
  score: number;
  isCorrect: boolean;
  errors: GameError[];
}

export interface ScoreDetail {
  action: string;
  description: string;
  points: number;
  type: 'bonus' | 'penalty';
  prescriptionId?: string;
  medicineId?: string;
}

export type ReplayActionType =
  | 'init'
  | 'reading'
  | 'place'
  | 'check_dosage'
  | 'check_contraindication'
  | 'check_batch'
  | 'confirm'
  | 'next'
  | 'finish';

export interface ReplayAction {
  type: ReplayActionType;
  timestamp: number;
  prescriptionIndex: number;
  score: number;
  placedMedicines: string[];
  checkResults: MedicineCheckResult[];
  description: string;
  medicineId?: string;
  medicineName?: string;
  checkResult?: 'correct' | 'incorrect';
}

export type CheckResult = 'pending' | 'correct' | 'incorrect' | 'unchecked';

export interface MedicineCheckResult {
  medicineId: string;
  dosage: CheckResult;
  contraindication: CheckResult;
  batch: CheckResult;
}

export type GameStatus = 'idle' | 'reading' | 'playing' | 'paused' | 'finished';

export interface GameState {
  status: GameStatus;
  levelId: string;
  currentPrescriptionIndex: number;
  score: number;
  timeRemaining: number;
  prescriptionTimeRemaining: number;
  errors: GameError[];
  actions: GameAction[];
  placedMedicines: string[];
  checkResults: MedicineCheckResult[];
  currentGameId: string | null;
  readingTimeRemaining: number;
}

export interface LevelConfig {
  id: string;
  name: string;
  description: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  timeLimit: number;
  prescriptionCount: number;
  prescriptionTimeLimit: number;
  readingTimeLimit: number;
  errorTypes: GameErrorType[];
  maxScore: number;
}

export interface GameRecord {
  id: string;
  levelId: string;
  levelName: string;
  startTime: number;
  endTime: number;
  totalTime: number;
  score: number;
  maxScore: number;
  starRating: number;
  prescriptions: Prescription[];
  errors: GameError[];
  actions: GameAction[];
  accuracy: number;
  prescriptionResults: PrescriptionResult[];
  scoreDetails: ScoreDetail[];
}

export interface ScoreRule {
  action: string;
  points: number;
  description: string;
  type: 'bonus' | 'penalty';
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
}
