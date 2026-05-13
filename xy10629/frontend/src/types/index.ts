export interface InstrumentPackage {
  id: number;
  package_no: string;
  name: string;
  type: string;
  instruments?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface RecoveryRecord {
  id: number;
  recovery_no: string;
  package_id: number;
  department: string;
  recovery_time: string;
  receiver: string;
  status: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  package_no?: string;
  package_name?: string;
}

export interface CleaningRecord {
  id: number;
  cleaning_no: string;
  recovery_id: number;
  cleaner: string;
  cleaning_method: string;
  start_time: string;
  end_time?: string;
  result: string;
  temperature?: number;
  duration?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  recovery_no?: string;
  package_no?: string;
  package_name?: string;
}

export interface SterilizationBatch {
  id: number;
  batch_no: string;
  cleaning_ids: string;
  sterilizer: string;
  sterilization_method: string;
  start_time: string;
  end_time?: string;
  temperature?: number;
  pressure?: number;
  duration?: number;
  result: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface FailureIsolation {
  id: number;
  isolation_no: string;
  source_type: string;
  source_id: number;
  reason: string;
  handler: string;
  isolation_time: string;
  status: string;
  corrective_action?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface DepartmentDistribution {
  id: number;
  distribution_no: string;
  package_id: number;
  department: string;
  distributor: string;
  distribution_time: string;
  receiver?: string;
  status: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  package_no?: string;
  package_name?: string;
}

export interface ModificationHistory {
  id: number;
  table_name: string;
  record_id: number;
  field_name: string;
  old_value?: string;
  new_value?: string;
  modified_by: string;
  modified_at: string;
}

export interface Statistics {
  totalPackages: number;
  totalRecovery: number;
  totalCleaning: number;
  totalSterilization: number;
  totalDistribution: number;
  pendingCleaning: number;
  failedCleaning: number;
  failedSterilization: number;
  activeIsolations: number;
  topDepartments: { department: string; count: number }[];
  topHandlers: { name: string; count: number }[];
}

export interface Anomalies {
  failedCleaning: CleaningRecord[];
  failedSterilization: SterilizationBatch[];
  activeIsolations: FailureIsolation[];
}
