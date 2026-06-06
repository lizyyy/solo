export interface SamplingIntervalSpec {
  id: string;
  name: string;
  intervalMs: number;
  description: string;
  importTime: string;
  operator: string;
}

export interface TemperatureCalibrationRecord {
  id: string;
  sensorId: string;
  sensorName: string;
  calibrationDate: string;
  calibrationPoint: number;
  measuredValue: number;
  correctionOffset: number;
  operator: string;
  remarks: string;
  isOldStandard?: boolean;
}

export type RecordStatus = 
  | 'normal'           
  | 'manual_modified_no_reason'  
  | 'recalibrated'     
  | 'pending_review';  

export type RecordSource = 'initial_import' | 'manual_correction' | 'recalculation';

export interface CoefficientModification {
  modifyTime: string;
  modifier: string;
  coefficientName: string;
  originalValue: number;
  modifiedValue: number;
  reason?: string;
  hasReason: boolean;
}

export interface BrakeHeatLoadRecord {
  id: string;
  trainNo: string;
  carriageNo: string;
  brakeId: string;
  recordTime: string;
  status: RecordStatus;
  source: RecordSource;
  
  brakingForce: number;
  brakingSpeed: number;
  brakingDuration: number;
  ambientTemp: number;
  frictionCoeff: number;
  heatDissipationCoeff: number;
  contactArea: number;
  
  rawHeatLoad?: number;
  calibratedHeatLoad?: number;
  finalHeatLoad: number;
  
  samplingIntervalId?: string;
  temperatureCalibrationId?: string;
  oldStandardCalibrationId?: string;
  
  modifications: CoefficientModification[];
  hasUnreasonedModification: boolean;
  
  reviewStatus: 'unreviewed' | 'reviewed';
  reviewer?: string;
  reviewTime?: string;
  reviewRemark?: string;
  
  calculationLog: string[];
  replayVersion: number;
}

export interface SystemState {
  samplingIntervals: SamplingIntervalSpec[];
  calibrationRecords: TemperatureCalibrationRecord[];
  heatLoadRecords: BrakeHeatLoadRecord[];
  activeTab: string;
}
