export interface Member {
  id: string;
  name: string;
  phone: string;
  email?: string;
  joinDate: string;
  latestMeasurement?: BodyMeasurement;
  activeInjuries: Injury[];
  remainingSessions: number;
  hasLowSessions: boolean;
}

export interface MemberDetail extends Member {
  bodyMeasurements: BodyMeasurement[];
  injuries: Injury[];
  plans: TrainingPlan[];
  payments: CoursePayment[];
  sessions: TrainingSession[];
  trainingAdvice?: TrainingAdvice;
  sessionSummary: {
    total: number;
    used: number;
    remaining: number;
    hasLowSessions: boolean;
  };
}

export interface BodyMeasurement {
  id: string;
  memberId: string;
  weight?: number;
  height?: number;
  bmi?: number;
  bodyFat?: number;
  muscleMass?: number;
  flexibility?: number;
  strength?: number;
  endurance?: number;
  cardio?: number;
  notes?: string;
  measuredAt: string;
}

export interface Injury {
  id: string;
  memberId: string;
  bodyPart: string;
  severity: string;
  description?: string;
  restrictedActions: string[];
  startDate: string;
  endDate?: string;
  isActive: boolean;
}

export interface TrainingPlan {
  id: string;
  memberId: string;
  name: string;
  description?: string;
  version: number;
  isActive: boolean;
  exercises: PlanExercise[];
  createdAt: string;
  updatedAt: string;
}

export interface PlanExercise {
  id: string;
  planId: string;
  name: string;
  sets: number;
  reps: number;
  weight?: number;
  notes?: string;
  orderIndex: number;
}

export interface CoursePayment {
  id: string;
  memberId: string;
  totalSessions: number;
  usedSessions: number;
  purchaseDate: string;
  note?: string;
}

export interface TrainingSession {
  id: string;
  memberId: string;
  planId?: string;
  plan?: { name: string; version: number };
  paymentId?: string;
  sessionDate: string;
  durationMinutes: number;
  feedback?: string;
  rating?: number;
  exercises: SessionExercise[];
  isCompleted: boolean;
  createdAt: string;
}

export interface SessionExercise {
  id: string;
  sessionId: string;
  exerciseName: string;
  completedSets: number;
  completedReps: number;
  actualWeight?: number;
  notes?: string;
}

export interface TrainingAdvice {
  focusAreas: string[];
  recommendations: string[];
  exercises: string[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  warning?: string;
  code?: string;
}
