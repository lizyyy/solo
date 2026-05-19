export interface VesselSchedule {
  id?: string;
  batchId?: string;
  vesselName: string;
  vesselImo: string;
  vesselAgent: string;
  arrivalTime: string;
  departureTime: string;
  berthId: string;
  draft: number;
  cargoType: string;
  isPriority: boolean;
  confirmedByAgent: boolean;
  importHash?: string;
  status?: 'normal' | 'pending' | 'failed';
}

export interface Berth {
  id: string;
  name: string;
  maxDepth: number;
  minDepth: number;
  allowedCargoTypes: string[];
  isAvailable: boolean;
  maintenanceStart?: string;
  maintenanceEnd?: string;
}

export interface TideRecord {
  date: string;
  time: string;
  height: number;
  type: 'HIGH' | 'LOW';
}

export interface ImportResultItem {
  record: Partial<VesselSchedule>;
  originalData: Record<string, any>;
  suggestions?: string[];
  errorReason?: string;
  ruleViolated?: string;
}

export interface ImportResult {
  batchId: string;
  totalProcessed: number;
  normal: ImportResultItem[];
  pending: ImportResultItem[];
  failed: ImportResultItem[];
  duplicates: number;
  importTime: string;
}

export interface ValidationRule {
  name: string;
  description: string;
  validate: (
    schedule: VesselSchedule,
    berths: Berth[],
    tides: TideRecord[],
    existingSchedules: VesselSchedule[]
  ) => {
    valid: boolean;
    status: 'normal' | 'pending' | 'failed';
    errorReason?: string;
    suggestions?: string[];
  };
}

export interface ImportBatch {
  batchId: string;
  importTime: string;
  recordHashes: string[];
  result: ImportResult;
}