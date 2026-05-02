export interface SubtitleCue {
  index: number;
  startTime: number;
  endTime: number;
  text: string;
}

export interface ParsedSubtitle {
  format: 'srt' | 'vtt';
  cues: SubtitleCue[];
  duration: number;
}

export interface TranscriptEntry {
  start: number;
  end: number;
  speaker?: string;
  text: string;
}

export interface SceneMark {
  timestamp: number;
  label: string;
  type: 'cut' | 'fade' | 'dialogue' | 'action';
}

export interface SyncRule {
  anchorPoints?: Array<{
    originalTime: number;
    translatedTime: number;
    label?: string;
  }>;
  linearDrift?: {
    slope: number;
    intercept: number;
  };
  overlapHandling?: 'split' | 'extend' | 'skip';
  maxDrift?: number;
}
