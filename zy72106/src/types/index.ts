export interface SensorRecord {
  id: string;
  sensorId: string;
  stationName: string;
  latitude: number;
  longitude: number;
  elevation: number;
  pWaveArrival: number | null;
  sWaveArrival: number | null;
  amplitude: number | null;
  quality: 'good' | 'fair' | 'poor';
  source: 'sensor' | 'manual' | 'legacy';
  notes?: string;
  createdAt: string;
}

export interface DeviceParams {
  deviceId: string;
  deviceName: string;
  sampleRate: number;
  sensitivity: number;
  calibrationDate: string;
  lastMaintenance: string;
}

export interface CalculationParams {
  pWaveVelocity: number;
  sWaveVelocity: number;
  velocityRatio: number;
  timeThreshold: number;
  locationMethod: 'geiger' | 'homogeneous' | 'layered';
  maxIterations: number;
  convergenceThreshold: number;
}

export interface LocationResult {
  id: string;
  earthquakeId: string;
  latitude: number;
  longitude: number;
  depth: number;
  originTime: number;
  magnitude: number;
  uncertainty: {
    horizontal: number;
    vertical: number;
  };
  residuals: Array<{
    sensorId: string;
    residual: number;
  }>;
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  extremeValues: string[];
  needsReview: string[];
}

export interface ManualCorrection {
  recordId: string;
  field: string;
  oldValue: any;
  newValue: any;
  reason: string;
}

export interface CalculationSnapshot {
  id: string;
  name: string;
  timestamp: string;
  operator: string;
  params: CalculationParams;
  inputRecords: SensorRecord[];
  result: LocationResult;
  manualCorrections: ManualCorrection[];
  notes: string;
}

export interface AnomalyRules {
  maxTimeDifference: number;
  minTimeDifference: number;
  amplitudeOutlierThreshold: number;
  maxResidual: number;
  boundaryThreshold: number;
}

export interface DataValidationIssue {
  type: 'empty' | 'duplicate' | 'boundary' | 'outlier';
  recordId: string;
  field?: string;
  message: string;
  severity: 'warning' | 'error' | 'info';
}

export type PageType = 'dashboard' | 'import' | 'workspace' | 'results' | 'history' | 'report';
