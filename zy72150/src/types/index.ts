export type PointSource = 'gis' | 'resident' | 'inspection' | 'street';

export type PointStatus = 'pending' | 'verified' | 'onsite' | 'processed';

export interface Point {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  source: PointSource;
  status: PointStatus;
  category: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  feedbacks: Feedback[];
  photos: Photo[];
  history: HistoryRecord[];
  conflicts: ConflictInfo[];
}

export interface MergeGroup {
  id: string;
  points: Point[];
  similarity: number;
  nameSimilarity: number;
  addressSimilarity: number;
  distance: number;
  confirmed: boolean;
  rejected: boolean;
  mergedName: string;
  mergedAddress: string;
}

export interface HistoryRecord {
  id: string;
  pointId: string;
  action: 'create' | 'update' | 'merge' | 'status_change' | 'remark' | 'import';
  field?: string;
  oldValue?: string;
  newValue?: string;
  operator: string;
  timestamp: string;
  remark?: string;
}

export interface ConflictInfo {
  type: 'name' | 'address' | 'category';
  gisValue: string;
  importValue: string;
  suggestion: string;
  resolved: boolean;
  resolution?: 'use_gis' | 'use_import' | 'custom';
  customValue?: string;
}

export interface Feedback {
  id: string;
  pointId: string;
  content: string;
  source: string;
  contact?: string;
  createTime: string;
}

export interface Photo {
  id: string;
  pointId: string;
  url: string;
  description?: string;
  uploadTime: string;
}

export interface ImportStats {
  total: number;
  gis: number;
  resident: number;
  inspection: number;
  street: number;
}

export type TabType = 'basic' | 'feedback' | 'photo' | 'history';
