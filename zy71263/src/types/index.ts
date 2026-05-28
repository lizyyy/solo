export interface Quaternion {
  w: number;
  x: number;
  y: number;
  z: number;
  source: 'raw' | 'computed';
}

export interface EulerAngles {
  roll: number;
  pitch: number;
  yaw: number;
  sequence: 'ZYX' | 'ZYZ' | 'XYZ';
  source: 'raw' | 'computed';
}

export interface ValidationResult {
  type: 'unnormalized' | 'gimbal_lock' | 'long_path';
  severity: 'warning' | 'error';
  message: string;
  pendingConfirmation: boolean;
}

export interface InterpolationConfig {
  method: 'slerp' | 'lerp';
  steps: number;
}

export interface SampleItem {
  key: string;
  label: string;
  value: unknown;
  tag: 'raw' | 'computed';
}

export interface SamplePack {
  id: string;
  name: string;
  description: string;
  quaternion: Quaternion;
  eulerAngles: EulerAngles;
  interpolationSteps: number;
  attitudeModel: string;
  targetAttitude: Quaternion;
  report: string;
  items: SampleItem[];
}

export interface ExportData {
  timestamp: string;
  currentQuaternion: Quaternion;
  targetQuaternion: Quaternion;
  eulerAngles: EulerAngles;
  interpolationConfig: InterpolationConfig;
  validationResults: ValidationResult[];
  animationProgress: number;
}
