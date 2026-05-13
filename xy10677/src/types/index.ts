export enum TreatmentPhase {
  INITIAL = 'initial',
  ALIGNMENT = 'alignment',
  SPACE_CLOSURE = 'space_closure',
  FINISHING = 'finishing',
  RETENTION = 'retention',
  COMPLETED = 'completed'
}

export enum AlignerStatus {
  PENDING = 'pending',
  IN_USE = 'in_use',
  COMPLETED = 'completed',
  SKIPPED = 'skipped',
  LOST = 'lost',
  DAMAGED = 'damaged'
}

export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  CONFIRMED = 'confirmed',
  COMPLETED = 'completed',
  MISSED = 'missed',
  CANCELLED = 'cancelled',
  RESCHEDULED = 'rescheduled'
}

export enum TodoStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum TodoPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum ExceptionType {
  OVERDUE = 'overdue',
  ALIGNER_ISSUE = 'aligner_issue',
  TREATMENT_DEVIATION = 'treatment_deviation',
  PATIENT_COMPLAINT = 'patient_complaint'
}

export enum ExceptionStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed'
}

export interface Patient {
  id: string;
  name: string;
  phone: string;
  doctorId: string;
  doctorName: string;
  startDate: string;
  currentPhase: TreatmentPhase;
  totalAligners: number;
  currentAligner: number;
  createdAt: string;
  updatedAt: string;
}

export interface AlignerBatch {
  id: string;
  patientId: string;
  batchNumber: number;
  startAligner: number;
  endAligner: number;
  status: AlignerStatus;
  receivedDate?: string;
  startDate?: string;
  expectedEndDate?: string;
  actualEndDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  batchId?: string;
  scheduledDate: string;
  scheduledTime: string;
  status: AppointmentStatus;
  type: string;
  doctorId: string;
  doctorName: string;
  actualDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TreatmentTodo {
  id: string;
  patientId: string;
  patientName: string;
  type: string;
  description: string;
  priority: TodoPriority;
  status: TodoStatus;
  assigneeId: string;
  assigneeName: string;
  dueDate?: string;
  completedAt?: string;
  completedBy?: string;
  relatedBatchId?: string;
  relatedAppointmentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExceptionRecord {
  id: string;
  patientId: string;
  type: ExceptionType;
  title: string;
  description: string;
  status: ExceptionStatus;
  relatedBatchId?: string;
  relatedAppointmentId?: string;
  assigneeId?: string;
  assigneeName?: string;
  resolvedAt?: string;
  resolution?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimelineEvent {
  id: string;
  patientId: string;
  eventType: string;
  title: string;
  description: string;
  reason?: string;
  operatorId?: string;
  operatorName?: string;
  relatedEntityId?: string;
  relatedEntityType?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  createdAt: string;
}

export interface ModificationHistory {
  id: string;
  entityType: string;
  entityId: string;
  fieldName: string;
  oldValue: any;
  newValue: any;
  modifiedBy: string;
  modifiedByName: string;
  modifiedAt: string;
  reason?: string;
}
