import { v4 as uuidv4 } from 'uuid';
import { 
  Source, 
  Event, 
  CalibrationResult, 
  Problem, 
  SyncIssue,
  Session,
  SESSION_VERSION,
  SourceType,
  EventType,
  ConfidenceLevel,
  ProblemType,
  Severity
} from './types';

export function createSource(overrides: Partial<Source> = {}): Source {
  return {
    id: uuidv4(),
    name: overrides.name || '未命名源',
    type: overrides.type || 'microphone',
    sampleRate: overrides.sampleRate,
    frameRate: overrides.frameRate,
    delayOffset: overrides.delayOffset || 0,
    isActive: overrides.isActive !== false,
    isInMix: overrides.isInMix !== false,
    color: overrides.color || getRandomColor(),
    notes: overrides.notes
  };
}

export function createEvent(overrides: Partial<Event> = {}): Event {
  if (!overrides.sourceId) {
    throw new Error('Event must have a sourceId');
  }
  return {
    id: uuidv4(),
    sourceId: overrides.sourceId,
    type: overrides.type || 'manual_anchor',
    timestamp: overrides.timestamp || Date.now(),
    value: overrides.value,
    rtpTimestamp: overrides.rtpTimestamp,
    description: overrides.description,
    confidence: overrides.confidence ?? 1.0,
    tags: overrides.tags
  };
}

export function createCalibrationResult(overrides: Partial<CalibrationResult> = {}): CalibrationResult {
  if (!overrides.sourceId) {
    throw new Error('CalibrationResult must have a sourceId');
  }
  return {
    sourceId: overrides.sourceId,
    delayOffset: overrides.delayOffset || 0,
    confidence: overrides.confidence ?? 0,
    confidenceLevel: overrides.confidenceLevel || 'none',
    evidence: overrides.evidence || [],
    isManualOverride: overrides.isManualOverride || false,
    driftRate: overrides.driftRate,
    calculatedAt: overrides.calculatedAt || Date.now()
  };
}

export function createProblem(overrides: Partial<Problem> = {}): Problem {
  if (!overrides.type) {
    throw new Error('Problem must have a type');
  }
  return {
    id: uuidv4(),
    type: overrides.type,
    severity: overrides.severity || 'warning',
    sourceId: overrides.sourceId,
    message: overrides.message || '',
    suggestion: overrides.suggestion || '',
    affectedEvents: overrides.affectedEvents,
    detectedAt: overrides.detectedAt || Date.now(),
    resolved: overrides.resolved || false
  };
}

export function createSyncIssue(overrides: Partial<SyncIssue> = {}): SyncIssue {
  return {
    id: uuidv4(),
    timeRange: overrides.timeRange || [0, 0],
    sources: overrides.sources || [],
    maxDeviation: overrides.maxDeviation || 0,
    description: overrides.description || ''
  };
}

export function createSession(overrides: Partial<Session> = {}): Session {
  return {
    version: SESSION_VERSION,
    id: overrides.id || uuidv4(),
    name: overrides.name || '未命名会话',
    description: overrides.description,
    createdAt: overrides.createdAt || Date.now(),
    updatedAt: overrides.updatedAt || Date.now(),
    timestampUnit: overrides.timestampUnit || 'ms',
    sources: overrides.sources || [],
    events: overrides.events || [],
    calibrationResults: overrides.calibrationResults || [],
    problems: overrides.problems || [],
    syncIssues: overrides.syncIssues || [],
    importLogs: overrides.importLogs || [],
    masterClockSourceId: overrides.masterClockSourceId
  };
}

export function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 0.9) return 'very_high';
  if (confidence >= 0.7) return 'high';
  if (confidence >= 0.5) return 'medium';
  if (confidence > 0) return 'low';
  return 'none';
}

export function getSourceTypeLabel(type: SourceType): string {
  const labels: Record<SourceType, string> = {
    microphone: '麦克风',
    camera: '摄像头',
    remote_stream: '远程流',
    local_file: '本地文件'
  };
  return labels[type] || type;
}

export function getEventTypeLabel(type: EventType): string {
  const labels: Record<EventType, string> = {
    clap_peak: '拍手峰值',
    flash_frame: '闪光帧',
    rtp_timestamp: 'RTP时间戳',
    manual_anchor: '人工锚点'
  };
  return labels[type] || type;
}

export function getProblemTypeLabel(type: ProblemType): string {
  const labels: Record<ProblemType, string> = {
    clock_drift: '时钟漂移',
    frame_drop: '丢帧',
    sample_rate_mismatch: '采样率不一致',
    duplicate_source: '源重复导入',
    anchor_conflict: '锚点冲突',
    jitter_too_high: '抖动过大',
    insufficient_anchors: '锚点不足'
  };
  return labels[type] || type;
}

export function getSeverityLabel(severity: Severity): string {
  const labels: Record<Severity, string> = {
    critical: '严重',
    warning: '警告',
    info: '信息'
  };
  return labels[severity] || severity;
}

export function getConfidenceLabel(level: ConfidenceLevel): string {
  const labels: Record<ConfidenceLevel, string> = {
    very_high: '极高',
    high: '高',
    medium: '中',
    low: '低',
    none: '无'
  };
  return labels[level] || level;
}

const COLOR_PALETTE = [
  '#e94560', '#f39c12', '#27ae60', '#3498db', 
  '#9b59b6', '#1abc9c', '#e67e22', '#34495e'
];

let colorIndex = 0;

export function getRandomColor(): string {
  const color = COLOR_PALETTE[colorIndex % COLOR_PALETTE.length];
  colorIndex++;
  return color;
}

export function resetColorIndex(): void {
  colorIndex = 0;
}
