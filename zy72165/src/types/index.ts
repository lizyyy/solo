export type PointStatus = 'pending' | 'processing' | 'conflict' | 'completed';
export type PointSource = 'street' | 'onsite' | 'approval' | 'other';
export type SchemeStatus = 'draft' | 'submitted' | 'approved' | 'rejected';
export type ConflictType = 'data_mismatch' | 'scheme_override' | 'note_conflict';

export interface Point {
  id: string;
  name: string;
  location: string;
  hospital: string;
  source: PointSource;
  sourceDesc?: string;
  rawNote: string;
  status: PointStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface Photo {
  id: string;
  pointId: string;
  dataUrl: string;
  fileName: string;
  rawRemark: string;
  source: string;
  takenAt?: string;
  uploadedAt: string;
}

export interface SchemeVersion {
  id: string;
  pointId: string;
  version: number;
  content: string;
  opinion: string;
  status: SchemeStatus;
  createdAt: string;
  createdBy: string;
  approvalRecord?: string;
}

export interface Conflict {
  id: string;
  pointId: string;
  type: ConflictType;
  photoEvidence: string;
  dataEvidence: string;
  suggestedAction: string;
  resolved: boolean;
  resolution?: string;
  createdAt: string;
}

export interface FilterState {
  search: string;
  status: PointStatus | 'all';
  hospital: string;
  source: PointSource | 'all';
}
