export interface FirmwareChunk {
  index: number;
  hash: string;
  size: number;
  filename: string;
}

export interface FirmwareManifest {
  version: string;
  targetDeviceType: string;
  minSupportedVersion: string;
  maxSupportedVersion: string;
  releaseDate: string;
  chunks: FirmwareChunk[];
  totalSize: number;
  metadata: {
    buildId: string;
    commitHash: string;
    signingKey: string;
  };
}

export interface DeviceCapability {
  deviceType: string;
  model: string;
  maxChunkSize: number;
  supportedHashAlgorithms: string[];
  minBatteryLevel: number;
  supportsResume: boolean;
  maxRolloutRate: number;
}

export interface RolloutDevice {
  deviceId: string;
  deviceType: string;
  currentVersion: string;
  targetVersion: string;
  priority: 'high' | 'medium' | 'low';
  region: string;
}

export interface ValidationError {
  code: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  affectedDevices?: string[];
  affectedChunks?: number[];
}

export interface ChunkValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  duplicateChunks: number[];
  missingChunks: number[];
  hashMismatches: { index: number; expected: string; actual: string }[];
  outOfOrderChunks: number[];
}

export interface VersionValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  incompatibleDevices: string[];
  devicesWithHigherVersion: string[];
  devicesBelowMinVersion: string[];
}

export interface CapabilityValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  unsupportedDevices: string[];
  insufficientBatteryDevices: string[];
  hashAlgorithmMismatch: string[];
}

export interface OtaValidationResult {
  manifest: FirmwareManifest;
  deviceCaps: DeviceCapability[];
  rolloutDevices: RolloutDevice[];
  chunkValidation: ChunkValidationResult;
  versionValidation: VersionValidationResult;
  capabilityValidation: CapabilityValidationResult;
  totalErrors: number;
  totalWarnings: number;
}

export interface RetryPlan {
  failedDevices: string[];
  retryOrder: string[];
  retryDelays: { deviceId: string; delayMinutes: number }[];
  estimatedCompletion: string;
}

export interface TimelineEvent {
  id: string;
  deviceId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startTime?: string;
  endTime?: string;
  progress: number;
  error?: string;
}
