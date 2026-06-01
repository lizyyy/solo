export type PointStatus = 'normal' | 'warning' | 'error' | 'empty' | 'duplicate' | 'boundary';
export type PointType = 'reflection-chamber' | 'microphone' | 'speaker' | 'boundary';
export type SchemeVersion = 'v1' | 'v2';

export interface Point {
  id: string;
  name: string;
  type: PointType;
  x: number | null;
  y: number | null;
  z: number | null;
  status: PointStatus;
  inspectionDate: string;
  isReflectionChamber: boolean;
  notes: string;
  schemeVersion: SchemeVersion;
  manualCoord?: {
    x: number; y: number; z: number; modifiedBy: string; reason: string };
  conflictWithPhoto?: boolean;
  photoEvidence?: { photoDesc: string; photoCoord: string };
  participatesInRayPath?: boolean;
}

export interface Photo {
  id: string;
  pointId: string;
  url: string;
  description: string;
  takenAt: string;
  markedCoordinates: string;
}

export interface Scheme {
  id: string;
  name: string;
  pointId: string;
  description: string;
  coordinates: { x: number; y: number; z: number };
}

export interface FilterCriteria {
  types: PointType[];
  statuses: PointStatus[];
  schemeVersions: SchemeVersion[];
  dateRange: [string, string] | null;
  onlyReflectionChambers: boolean;
  onlyAnomalies: boolean;
}

export interface TimelineState {
  currentDate: string;
  minDate: string;
  maxDate: string;
  playbackSpeed: number;
  isPlaying: boolean;
}

export interface SoundRayPath {
  points: { x: number; y: number; z: number }[];
  reflectedChambers: string[];
}

export interface ConflictEvidence {
  pointId: string;
  pointName: string;
  photoCoord?: string;
  tableCoord?: string;
  manualCoord?: string;
  schemeCoord?: string;
  suggestedAction: string;
  friendlyMessage: string;
}
