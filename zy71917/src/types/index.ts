export interface Project {
  id: string;
  name: string;
  audioFileName: string;
  audioDuration: number;
  audioFileHash: string;
  createdAt: number;
  updatedAt: number;
}

export interface SubtitleTrack {
  id: string;
  projectId: string;
  language: string;
  label: string;
  entries: string[];
  uploadVersion: number;
}

export interface SubtitleEntry {
  id: string;
  trackId: string;
  index: number;
  startTime: number;
  endTime: number;
  text: string;
  originalStartTime: number;
  originalEndTime: number;
  originalText: string;
  isManuallyAdjusted: boolean;
  adjustmentHistory: string[];
}

export interface AdjustmentRecord {
  id: string;
  entryId: string;
  timestamp: number;
  operator: string;
  field: string;
  oldValue: string;
  newValue: string;
}

export interface EditPoint {
  id: string;
  projectId: string;
  time: number;
  type: "cut" | "ad" | "transition";
  label: string;
  color: string;
}

export interface AlignmentIssue {
  id: string;
  projectId: string;
  type: "silent_deletion" | "timeline_drift" | "missing_line";
  severity: "error" | "warning" | "info";
  startTime: number;
  endTime: number;
  description: string;
  affectedTrackIds: string[];
  status: "open" | "resolved" | "dismissed";
  resolution?: string;
  resolvedBy?: string;
  resolvedAt?: number;
}

export interface Segment {
  id: string;
  projectId: string;
  startTime: number;
  endTime: number;
  alignmentStatus: "aligned" | "needs_review" | "has_issue";
  notes: string;
  reviewedBy?: string;
}

export interface TimelineState {
  zoom: number;
  scrollX: number;
  playheadPosition: number;
  selectedSegmentId: string | null;
  visibleTracks: string[];
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  loopStart?: number;
  loopEnd?: number;
}
