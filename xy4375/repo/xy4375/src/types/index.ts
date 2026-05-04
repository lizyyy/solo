export interface Prescription {
  id: string;
  prescriptionNo: string;
  patientName: string;
  patientAge: number;
  patientGender: 'male' | 'female' | 'unknown';
  department: string;
  doctorName: string;
  diagnosis: string;
  herbs: PrescriptionHerb[];
  decoctionMethod: DecoctionMethod;
  dosage: string;
  frequency: string;
  totalDoses: number;
  preparedDoses: number;
  orderDate: string;
  pickupDate: string;
  pickupTimeSlotId: string;
  status: 'pending' | 'preparing' | 'decocting' | 'completed' | 'picked_up' | 'cancelled';
  priority: 'normal' | 'urgent' | 'emergency';
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export interface PrescriptionHerb {
  herbId: string;
  herbName: string;
  pinyin: string;
  dosage: number;
  unit: string;
  batchId: string;
  specialProcess: SpecialProcessType;
  notes: string;
}

export type SpecialProcessType = 
  | 'normal'
  | 'first_decoct'
  | 'later_add'
  | 'wrap_decoct'
  | 'dissolve'
  | 'infuse'
  | 'decoct_separately'
  | 'powder';

export interface DecoctionMethod {
  type: 'water' | 'wine' | 'water_wine' | 'other';
  waterAmount: string;
  soakingTime: number;
  firstDecoctionTime: number;
  secondDecoctionTime: number;
  fireType: 'strong' | 'gentle' | 'mixed';
  notes: string;
}

export interface HerbBatch {
  id: string;
  herbId: string;
  herbName: string;
  pinyin: string;
  batchNo: string;
  origin: string;
  supplier: string;
  productionDate: string;
  expiryDate: string;
  qualityStatus: 'qualified' | 'pending' | 'rejected';
  storageCondition: string;
  remainingQuantity: number;
  unit: string;
  pricePerUnit: number;
  inspectionReportNo: string;
  notes: string;
  createdAt: number;
}

export interface DecoctionPot {
  id: string;
  potNo: string;
  name: string;
  capacity: number;
  capacityUnit: string;
  type: 'automatic' | 'semi_automatic' | 'manual';
  status: 'idle' | 'in_use' | 'maintenance' | 'disabled';
  currentPrescriptionId: string | null;
  currentScheduleId: string | null;
  lastUsedAt: number | null;
  location: string;
  notes: string;
}

export interface PickupTimeSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  maxCapacity: number;
  currentBookings: number;
  status: 'active' | 'full' | 'cancelled';
  notes: string;
}

export interface DecoctionSchedule {
  id: string;
  scheduleDate: string;
  potId: string;
  potNo: string;
  batchNo: number;
  sequence: number;
  prescriptions: string[];
  status: 'pending' | 'preparing' | 'decocting' | 'completed' | 'reviewed';
  startTime: number | null;
  endTime: number | null;
  actualFirstDecoctionTime: number | null;
  actualSecondDecoctionTime: number | null;
  operatorName: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export type RiskType = 
  | 'eighteen_incompatible'
  | 'nineteen_counteracts'
  | 'first_decoct_missing'
  | 'later_add_wrong_order'
  | 'cross_prescription_mix'
  | 'expired_batch'
  | 'batch_near_expiry'
  | 'pickup_timeout'
  | 'dosage_anomaly'
  | 'herb_conflict'
  | 'pot_capacity_exceeded'
  | 'missing_batch'
  | 'urgent_priority'
  | 'review_required';

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface RiskEvent {
  id: string;
  type: RiskType;
  severity: RiskSeverity;
  title: string;
  description: string;
  relatedPrescriptionId: string | null;
  relatedHerbName: string | null;
  relatedBatchId: string | null;
  relatedPotId: string | null;
  relatedScheduleId: string | null;
  evidence: RiskEvidence[];
  isReviewed: boolean;
  reviewResult: 'confirmed' | 'false_positive' | 'mitigated' | 'escalated' | null;
  reviewedBy: string | null;
  reviewedAt: number | null;
  reviewNotes: string;
  originalRiskLevel: RiskSeverity | null;
  createdAt: number;
}

export interface RiskEvidence {
  type: 'herb_pair' | 'batch_data' | 'schedule_data' | 'prescription_data' | 'pot_data' | 'time_data';
  description: string;
  details: Record<string, unknown>;
}

export interface ReviewLog {
  id: string;
  riskEventId: string;
  prescriptionId: string | null;
  scheduleId: string | null;
  reviewerName: string;
  reviewResult: 'confirmed' | 'false_positive' | 'mitigated' | 'escalated';
  previousResult: 'confirmed' | 'false_positive' | 'mitigated' | 'escalated' | null;
  notes: string;
  createdAt: number;
}

export interface AuditTrail {
  id: string;
  entityType: 'prescription' | 'batch' | 'schedule' | 'pot' | 'risk' | 'review';
  entityId: string;
  action: 'create' | 'update' | 'delete' | 'import' | 'export' | 'review' | 'status_change';
  previousValue: string | null;
  newValue: string | null;
  operatorName: string;
  timestamp: number;
  details: string;
}

export interface DailyWorkSession {
  id: string;
  date: string;
  operatorName: string;
  startTime: number;
  endTime: number | null;
  status: 'active' | 'paused' | 'completed';
  prescriptionsImported: number;
  batchesImported: number;
  schedulesCreated: number;
  risksDetected: number;
  risksReviewed: number;
  notes: string;
}

export interface ImportResult<T> {
  success: boolean;
  data: T[];
  errors: ImportError[];
  warnings: ImportWarning[];
  stats: {
    total: number;
    imported: number;
    skipped: number;
    updated: number;
  };
}

export interface ImportError {
  row: number;
  field: string;
  value: string;
  message: string;
}

export interface ImportWarning {
  row: number;
  field: string;
  message: string;
}

export interface ExportConfig {
  includePrescriptions: boolean;
  includeBatches: boolean;
  includeSchedules: boolean;
  includeRisks: boolean;
  includeReviews: boolean;
  includeAuditTrail: boolean;
  dateRange: {
    start: string;
    end: string;
  } | null;
  riskFilter: RiskType[] | null;
  severityFilter: RiskSeverity[] | null;
  statusFilter: string[] | null;
}

export interface AppState {
  currentSession: DailyWorkSession | null;
  activeDate: string;
  prescriptions: Prescription[];
  herbBatches: HerbBatch[];
  decoctionPots: DecoctionPot[];
  pickupTimeSlots: PickupTimeSlot[];
  schedules: DecoctionSchedule[];
  riskEvents: RiskEvent[];
  reviewLogs: ReviewLog[];
  auditTrails: AuditTrail[];
  isLoading: boolean;
  error: string | null;
  selectedPrescriptionId: string | null;
  selectedScheduleId: string | null;
  selectedRiskId: string | null;
  activeView: 'dashboard' | 'import' | 'prescriptions' | 'schedules' | 'risks' | 'export';
}

export interface EighteenIncompatiblePair {
  herb1: string;
  herb1Pinyin: string;
  herb2: string;
  herb2Pinyin: string;
  description: string;
  severity: RiskSeverity;
}

export interface NineteenCounteractsPair {
  herb1: string;
  herb1Pinyin: string;
  herb2: string;
  herb2Pinyin: string;
  description: string;
  severity: RiskSeverity;
}

export interface ProcessingRule {
  processType: SpecialProcessType;
  herbNames: string[];
  conditions: string[];
  requiredTime: number;
  notes: string;
}
