export interface BalloonParams {
  temperature: number | null;
  temperatureUnit: 'C' | 'F' | 'K' | string;
  payload: number | null;
  payloadUnit: 'kg' | 'lb' | string;
  windSpeed: number | null;
  windSpeedUnit: 'm/s' | 'km/h' | 'mph' | 'knots' | string;
  balloonVolume: number | null;
  volumeUnit: 'm³' | 'ft³' | string;
  safetyNotes: string;
  experimentName: string;
}

export interface ValidationError {
  field: string;
  step: string;
  message: string;
  severity: 'error' | 'warning';
  actualValue?: string;
  expectedRange?: string;
}

export interface BuoyancyResult {
  buoyantForce: number;
  netLift: number;
  airDensity: number;
  hotAirDensity: number;
  isValid: boolean;
}

export interface SafetyThresholds {
  maxWindSpeed: number;
  minTemperature: number;
  maxTemperature: number;
  maxPayload: number;
  minVolume: number;
}

export interface LaunchWindowResult {
  canLaunch: boolean;
  status: 'safe' | 'warning' | 'danger' | 'unknown';
  buoyancy: BuoyancyResult | null;
  errors: ValidationError[];
  warnings: ValidationError[];
  recommendations: string[];
  timestamp: Date;
}

export interface ExperimentRecord {
  id: string;
  name: string;
  params: BalloonParams;
  result: LaunchWindowResult;
  createdAt: string;
}

export interface ExportReport {
  experimentName: string;
  timestamp: string;
  parameters: {
    temperature: string;
    payload: string;
    windSpeed: string;
    balloonVolume: string;
    safetyNotes: string;
  };
  launchStatus: string;
  buoyancyCalculation: {
    buoyantForce: string;
    netLift: string;
    airDensity: string;
  } | null;
  issues: {
    errors: string[];
    warnings: string[];
  };
  recommendations: string[];
  conclusion: string;
}
