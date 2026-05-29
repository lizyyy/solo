export type AudioStatus = 'pending' | 'analyzing' | 'ready' | 'processing' | 'completed' | 'error';
export type PresetName = 'podcast' | 'music' | 'audiobook' | 'voiceover';
export interface Selection {
  start: number;
  end: number;
}

export interface AudioFile {
  id: string;
  name: string;
  duration: number;
  format: string;
  sampleRate: number;
  channels: number;
  status: AudioStatus;
  audioBuffer?: AudioBuffer;
  waveformData?: number[];
  processedAudioBuffer?: AudioBuffer;
  integratedLufs?: number;
  truePeak?: number;
  createdAt: number;
  updatedAt: number;
}

export interface Track {
  id: string;
  audioId: string;
  name: string;
  guestName: string;
  gain: number;
  muted: boolean;
  solo: boolean;
  color: string;
}

export interface LoudnessData {
  id: string;
  audioId: string;
  integratedLufs: number;
  rangeLufs: number;
  truePeak: number;
  momentaryLufs: number[];
  shortTermLufs: number[];
  samplePoints: number[];
}

export interface PeakMark {
  id: string;
  audioId: string;
  time: number;
  value: number;
  fixed: boolean;
  type: 'clip' | 'overshoot' | 'manual';
}

export interface ProtectedRegion {
  id: string;
  audioId: string;
  startTime: number;
  endTime: number;
  type: 'intro' | 'outro' | 'music' | 'custom';
  enabled: boolean;
}

export interface ProcessConfig {
  targetLufs: number;
  lufsTolerance: number;
  truePeakLimit: number;
  compressorThreshold: number;
  compressorRatio: number;
  attackTime: number;
  releaseTime: number;
  enableAutoGain: boolean;
  enablePeakLimiter: boolean;
  protectIntro: boolean;
  protectOutro: boolean;
  introDuration: number;
  outroDuration: number;
  fadeInDuration: number;
  fadeOutDuration: number;
}

export interface HistoryRecord {
  id: string;
  audioFileId: string;
  description: string;
  config: ProcessConfig;
  previousConfig?: ProcessConfig;
  timestamp: number;
}

export interface ProcessReport {
  id: string;
  audioFileId: string;
  originalLufs: number;
  processedLufs: number;
  originalTruePeak: number;
  processedTruePeak: number;
  duration: number;
  config: ProcessConfig;
  timestamp: number;
  peakMarksCount: number;
  fixedPeaksCount: number;
  processingTime: number;
}

export interface AppState {
  audioFiles: AudioFile[];
  tracks: Track[];
  loudnessData: Record<string, LoudnessData>;
  peakMarks: PeakMark[];
  protectedRegions: ProtectedRegion[];
  processConfig: ProcessConfig;
  historyRecords: HistoryRecord[];
  reports: ProcessReport[];
  currentAudioId: string | null;
  isPlaying: boolean;
  currentTime: number;
  selection: { start: number; end: number } | null;
}
