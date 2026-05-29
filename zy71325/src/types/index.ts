export type ChannelType = "drums" | "bass" | "vocals" | "other"

export interface TrackAudio {
  id: string
  sessionId: string
  fileName: string
  fileHash: string
  channelType: ChannelType
  sampleRate: number
  duration: number
  waveformPeaks: number[]
  startOffset: number
  rawAudioData: ArrayBuffer | null
}

export interface BeatPoint {
  time: number
  bpm: number
  confidence: number
}

export interface LateMarker {
  musicianName: string
  joinTime: number
  channelType: string
}

export interface RehearsalMeta {
  id: string
  sessionId: string
  rehearsalTime: string
  musicianNotes: string
  beatPoints: BeatPoint[]
  lateMarkers: LateMarker[]
}

export type AnomalyType = "offset_error" | "beat_drift" | "duplicate_clip" | "late_join"
export type Severity = "warning" | "error"
export type ConflictStrategy = "skip" | "overwrite" | "append"

export interface AnomalyFragment {
  id: string
  sessionId: string
  type: AnomalyType
  startTime: number
  endTime: number
  trackId: string
  severity: Severity
  note: string
  resolved: boolean
}

export interface DriftSegment {
  startTime: number
  endTime: number
  bpmDelta: number
}

export interface TrackAlignmentState {
  trackId: string
  offsetMs: number
  bpm: number
  driftSegments: DriftSegment[]
}

export interface AlignmentVersion {
  id: string
  sessionId: string
  createdAt: string
  summary: string
  trackStates: TrackAlignmentState[]
  anomalies: AnomalyFragment[]
  parentVersionId: string | null
}

export interface ExportRecord {
  id: string
  versionId: string
  sessionId: string
  format: "pdf" | "json"
  exportedAt: string
  fileHash: string
  contentSummary: string
}

export interface RehearsalSession {
  id: string
  name: string
  createdAt: string
  trackIds: string[]
}

export interface MaterialFile {
  id: string
  sessionId: string
  fileName: string
  fileType: "audio" | "time" | "notes" | "beats" | "late_markers" | "report"
  fileSize: number
  fileHash: string
  importedAt: string
  status: "normal" | "anomaly" | "pending"
  parsed: boolean
}

export const ANOMALY_TYPE_LABELS: Record<AnomalyType, string> = {
  offset_error: "起点偏移",
  beat_drift: "节拍漂移",
  duplicate_clip: "重复剪辑",
  late_join: "迟到加入",
}

export const CHANNEL_TYPE_LABELS: Record<ChannelType, string> = {
  drums: "鼓",
  bass: "贝斯",
  vocals: "人声",
  other: "其他",
}

export const ANOMALY_COLORS: Record<AnomalyType, string> = {
  offset_error: "#E8A838",
  beat_drift: "#E74C3C",
  duplicate_clip: "#9B59B6",
  late_join: "#3498DB",
}
