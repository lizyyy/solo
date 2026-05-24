export type CrackStatus = 'new' | 'developing' | 'stable' | 'repaired' | 'pending_review';

export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface Photo {
  id: string;
  url: string;
  position: Position3D;
  batchId: string;
  crackId?: string;
  annotation?: string;
}

export interface InspectionRecord {
  id: string;
  batchId: string;
  date: string;
  length: number;
  width: number;
  status: CrackStatus;
  photoId?: string;
  notes?: string;
}

export interface RepairRecord {
  id: string;
  crackId: string;
  date: string;
  method: string;
  description: string;
  beforePhotoId?: string;
  afterPhotoId?: string;
  nextReviewDate?: string;
}

export interface CrackPoint {
  id: string;
  position: Position3D;
  endPosition?: Position3D;
  length: number;
  width: number;
  description: string;
  status: CrackStatus;
  photos: Photo[];
  history: InspectionRecord[];
  repairRecords: RepairRecord[];
}

export interface InspectionBatch {
  id: string;
  name: string;
  date: string;
  inspector: string;
  notes?: string;
}

export interface CameraView {
  position: Position3D;
  target: Position3D;
}

export interface Filters {
  status: CrackStatus[];
  searchQuery: string;
}

export interface AppState {
  batches: InspectionBatch[];
  cracks: CrackPoint[];
  currentBatchId: string;
  selectedCrackId: string | null;
  cameraView: CameraView;
  filters: Filters;
  isPlaying: boolean;
  playSpeed: number;
  sampleDataLoaded: boolean;
}

export interface ReportData {
  batchName: string;
  batchDate: string;
  inspector: string;
  filters: Filters;
  cameraView: CameraView;
  cracks: CrackPoint[];
  totalCracks: number;
  statusCounts: Record<CrackStatus, number>;
  screenshot?: string;
}

export const STATUS_COLORS: Record<CrackStatus, string> = {
  new: '#FF4D4F',
  developing: '#FF7A45',
  stable: '#FAAD14',
  repaired: '#52C41A',
  pending_review: '#165DFF',
};

export const STATUS_LABELS: Record<CrackStatus, string> = {
  new: '新增裂缝',
  developing: '发展中',
  stable: '稳定',
  repaired: '已维修',
  pending_review: '待复查',
};
