export type ErrorType =
  | 'PRESSURE_TOO_HIGH'
  | 'PRESSURE_TOO_LOW'
  | 'ANTISKATING_DIRECTION_WRONG'
  | 'RADIUS_UNIT_ERROR'
  | 'TONEARM_LENGTH_MISMATCH';

export type Severity = 'low' | 'medium' | 'high';

export type RadiusUnit = 'cm' | 'inch';
export type AntiSkatingDirection = 'normal' | 'reverse';

export interface CalibrationError {
  type: ErrorType;
  message: string;
  severity: Severity;
  timestamp: number;
}

export interface CalibrationParams {
  stylusPressure: number;
  antiSkating: number;
  antiSkatingDirection: AntiSkatingDirection;
  tonearmLength: number;
  recordRadius: number;
  recordRadiusUnit: RadiusUnit;
  testTrack: string;
}

export interface CalibrationResult {
  torque: number;
  wearLevel: number;
  errors: CalibrationError[];
}

export interface CalibrationRecord extends CalibrationParams, CalibrationResult {
  id: string;
  timestamp: number;
  screenshot: string | null;
  notes: string;
  manualCorrection: string;
}

export interface TestTrack {
  id: string;
  name: string;
  difficulty: 'easy' | 'medium' | 'hard';
  description: string;
  difficultyFactor: number;
}

export interface WearFactorConfig {
  pressureFactor: number;
  antiSkatingFactor: number;
  lengthFactor: number;
  trackFactor: number;
  maxExpectedWear: number;
}

export const PHYSICAL_CONSTANTS = {
  GRAVITY: 9.8,
  EFFECTIVE_LENGTH_RATIO: 0.85,
  TONEARM_OFFSET: 18,
  STANDARD_TONEARM_LENGTH: 250,
  MIN_PRESSURE: 0.5,
  MAX_PRESSURE: 3.0,
  MIN_ANTISKATING: 0,
  MAX_ANTISKATING: 3,
  MIN_TONEARM_LENGTH: 200,
  MAX_TONEARM_LENGTH: 300,
  MIN_RECORD_RADIUS_CM: 7,
  MAX_RECORD_RADIUS_CM: 15,
  IDEAL_ANTISKATING_MULTIPLIER: 0.3,
} as const;

export const WEAR_FACTORS: WearFactorConfig = {
  pressureFactor: 15,
  antiSkatingFactor: 20,
  lengthFactor: 0.5,
  trackFactor: 1.2,
  maxExpectedWear: 100,
};
