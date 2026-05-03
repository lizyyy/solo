export interface MasterPlaylist {
  version: number;
  variants: VariantInfo[];
  alternativeRenditions: AlternativeRendition[];
  rawContent: string;
}

export interface VariantInfo {
  bandwidth: number;
  averageBandwidth?: number;
  codecs: string;
  resolution?: { width: number; height: number };
  frameRate?: number;
  uri: string;
  name?: string;
}

export interface AlternativeRendition {
  type: 'AUDIO' | 'VIDEO' | 'SUBTITLES' | 'CLOSED-CAPTIONS';
  uri?: string;
  groupId: string;
  language?: string;
  name: string;
  isDefault?: boolean;
  autoselect?: boolean;
}

export interface VariantPlaylist {
  version: number;
  targetDuration: number;
  mediaSequence: number;
  isEnded: boolean;
  isLive: boolean;
  segments: SegmentInfo[];
  discontinuities: DiscontinuityInfo[];
  encryptionKeys: EncryptionKeyInfo[];
  rawContent: string;
  fileName: string;
}

export interface SegmentInfo {
  uri: string;
  duration: number;
  sequenceNumber: number;
  byteRange?: { offset: number; length: number };
  encryptionKeyId?: string;
  discontinuitySequence?: number;
  startTime?: number;
  endTime?: number;
  programDateTime?: Date;
}

export interface DiscontinuityInfo {
  sequenceNumber: number;
  reason?: string;
}

export interface EncryptionKeyInfo {
  method: 'NONE' | 'AES-128' | 'SAMPLE-AES';
  uri?: string;
  iv?: string;
  keyFormat?: string;
  keyFormatVersions?: string;
  segmentSequenceStart: number;
}

export interface SegmentManifestEntry {
  uri: string;
  path: string;
  size: number;
  duration: number;
  sequenceNumber: number;
  variant: string;
  md5?: string;
  programDateTime?: Date;
}

export interface CdnAccessEntry {
  uri: string;
  statusCode: number;
  responseTimeMs: number;
  timestamp: Date;
  error?: string;
  byteSize?: number;
}

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  enabled: boolean;
  config?: Record<string, unknown>;
}

export interface ValidationIssue {
  ruleId: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  location?: string;
  details?: string;
  context?: Record<string, unknown>;
}

export interface ValidationResult {
  summary: {
    total: number;
    errors: number;
    warnings: number;
    infos: number;
  };
  issues: ValidationIssue[];
  metadata: {
    processedAt: Date;
    duration: number;
    packageName: string;
  };
  analysis: PackageAnalysis;
}

export interface PackageAnalysis {
  variants: {
    uri: string;
    bandwidth: number;
    resolution?: { width: number; height: number };
    segmentCount: number;
    totalDuration: number;
    targetDuration: number;
    actualDurations: number[];
    mediaSequenceStart: number;
    mediaSequenceEnd: number;
    hasDiscontinuities: boolean;
    discontinuityCount: number;
    isEncrypted: boolean;
    encryptionKeyCount: number;
  }[];
  timeline: TimelineSegment[];
  cdnStatus: {
    totalRequests: number;
    successCount: number;
    errorCount: number;
    avgResponseTimeMs: number;
    maxResponseTimeMs: number;
    statusCodeBreakdown: Record<number, number>;
  };
  crossMidnight: boolean;
}

export interface TimelineSegment {
  variant: string;
  sequenceNumber: number;
  startTime: number;
  endTime: number;
  duration: number;
  programDateTime?: string;
  status: 'present' | 'missing' | 'duplicate';
}

export interface RulesConfig {
  rules: ValidationRule[];
  thresholds?: {
    maxSegmentDurationVariance: number;
    minBitrateBps: number;
    maxBitrateBps: number;
    maxResponseTimeMs: number;
  };
}
