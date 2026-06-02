export type PointStatus = 'approved' | 'pending' | 'conflict' | 'legacy';
export type ConflictType = 'capacity' | 'timeSlot' | 'empty' | 'duplicate' | null;
export type SourceType = 'current' | 'legacy' | 'manual';
export type FeedbackType = 'complaint' | 'suggestion' | 'info';

export interface SignalPoint {
  id: string;
  name: string;
  location: string;
  lat: number;
  lng: number;
  status: PointStatus;
  street: string;
  capacity?: number;
  designCapacity?: number;
  timeSlot?: string;
  hasConflict: boolean;
  conflictType: ConflictType;
  conflictNote?: string;
  manualNote?: string;
  sourceType: SourceType;
  createdAt: string;
  updatedAt: string;
}

export interface Feedback {
  id: string;
  pointId: string;
  residentName: string;
  content: string;
  type: FeedbackType;
  createdAt: string;
}

export interface PlanVersion {
  id: string;
  pointId: string;
  version: string;
  content: string;
  author: string;
  changeLog: string;
  isLegacy: boolean;
  createdAt: string;
}

export interface InspectionPhoto {
  id: string;
  pointId: string;
  url: string;
  description: string;
  createdAt: string;
}

export interface ReviewReport {
  id: string;
  pointId: string;
  summary: string;
  exceptionNote: string;
  status: PointStatus;
  createdAt: string;
}

export interface ConflictResult {
  hasConflict: boolean;
  type: ConflictType;
  humanReadable: string;
  severity: 'warning' | 'error';
}

export interface AppData {
  points: SignalPoint[];
  feedbacks: Feedback[];
  planVersions: PlanVersion[];
  photos: InspectionPhoto[];
  reports: ReviewReport[];
}
