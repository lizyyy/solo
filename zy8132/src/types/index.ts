export interface AudioMarker {
  id: string;
  startTime: number;
  endTime: number;
  type: 'speech' | 'silence';
  confidence?: number;
}

export interface Subtitle {
  id: string;
  index: number;
  startTime: number;
  endTime: number;
  text: string;
  originalStartTime?: number;
  originalEndTime?: number;
  isModified?: boolean;
}

export interface ProgramSegment {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  segmentType: string;
  metadata?: Record<string, unknown>;
}

export interface ValidationIssue {
  id: string;
  subtitleId: string;
  type: 
    | 'overlap_with_silence'
    | 'overlap_between_subtitles'
    | 'cross_segment'
    | 'time_gap'
    | 'start_in_silence'
    | 'end_in_silence';
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestion?: string;
  details?: {
    startTime?: number;
    endTime?: number;
    relatedId?: string;
  };
}

export interface ProjectState {
  audioMarkers: AudioMarker[];
  subtitles: Subtitle[];
  programSegments: ProgramSegment[];
  validationIssues: ValidationIssue[];
  filesLoaded: {
    audioMarkers: boolean;
    subtitles: boolean;
    programSegments: boolean;
  };
  selectedSubtitleId?: string;
  isModified: boolean;
  projectName?: string;
}

export interface ExportReport {
  generatedAt: string;
  projectName?: string;
  totalSubtitles: number;
  modifiedSubtitles: number;
  issuesResolved: number;
  issuesRemaining: number;
  issuesByType: Record<string, number>;
  timeline: {
    totalDuration: number;
    speechDuration: number;
    silenceDuration: number;
  };
}
