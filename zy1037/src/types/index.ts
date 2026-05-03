export type AudioRole = 'intro' | 'main' | 'ad' | 'outro';

export interface AudioItem {
  id: string;
  path: string;
  role: AudioRole;
  name?: string;
}

export interface Chapter {
  id: string;
  title: string;
  startTime: string;
  audioRef?: string;
}

export interface Manifest {
  version: string;
  project: {
    name: string;
    episode: string;
    publishDate?: string;
  };
  settings: {
    targetLoudness: number;
    loudnessTolerance: number;
    maxSilenceAtStart: number;
    maxSilenceAtEnd: number;
    sampleRate?: number;
    channels?: number;
  };
  namingRules?: {
    pattern: string;
    description?: string;
    examples?: string[];
  };
  export: {
    directory: string;
  };
  audioFiles: AudioItem[];
  chapters?: Chapter[];
}

export interface AudioInfo {
  path: string;
  exists: boolean;
  duration: number;
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  fileSize: number;
  format: string;
}

export interface LoudnessResult {
  rmsDb: number;
  peakDb: number;
  normalizedRmsDb: number;
}

export interface SilenceDetection {
  startSilenceDuration: number;
  endSilenceDuration: number;
  hasLongSilenceAtStart: boolean;
  hasLongSilenceAtEnd: boolean;
}

export interface ValidationIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  category: 'file' | 'naming' | 'timing' | 'loudness' | 'silence' | 'chapter' | 'format';
  message: string;
  detail?: string;
  suggestion?: string;
  context?: Record<string, unknown>;
}

export interface ValidationResult {
  success: boolean;
  totalIssues: number;
  errors: number;
  warnings: number;
  infos: number;
  issues: ValidationIssue[];
}

export interface FileInspection {
  id: string;
  role: AudioRole;
  path: string;
  exists: boolean;
  info?: AudioInfo;
  loudness?: LoudnessResult;
  silence?: SilenceDetection;
  passed: boolean;
}

export interface InspectionResult {
  manifest: Manifest;
  files: FileInspection[];
  summary: {
    totalFiles: number;
    existingFiles: number;
    avgRmsDb?: number;
    minRmsDb?: number;
    maxRmsDb?: number;
  };
}

export interface ReportData {
  generatedAt: string;
  project: {
    name: string;
    episode: string;
  };
  inspection: InspectionResult;
  validation: ValidationResult;
  summary: {
    status: 'pass' | 'warn' | 'fail';
    conclusion: string;
    recommendations: string[];
  };
}
