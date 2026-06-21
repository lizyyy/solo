export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'has_legacy';
export type LayerCategory = '给水' | '排水' | '暖通' | '电气' | '消防';
export type LayerStatus = 'approved' | 'needs_modify' | 'rejected';

export interface ReviewTask {
  id: string;
  projectName: string;
  drawingVersion: string;
  cadSource: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  layerCount: number;
  openIssueCount: number;
  description?: string;
}

export interface CadLayer {
  id: string;
  taskId: string;
  originalName: string;
  displayName?: string;
  category: LayerCategory;
  color: string;
  lineType: string;
  currentStatus: LayerStatus;
  latestOpinion: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface LayerHistory {
  id: string;
  layerId: string;
  version: number;
  status: LayerStatus;
  opinion: string;
  note: string;
  reviewer: string;
  reviewedAt: string;
  standardTags: string[];
  screenshotIds: string[];
  changedFields: string[];
}

export interface Screenshot {
  id: string;
  taskId: string;
  layerId?: string;
  fileName: string;
  storedPath: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  caption: string;
  standardTags: string[];
  boundVersion?: number;
  isDeleted: boolean;
  url?: string;
  layerOriginalName?: string;
  layerDisplayName?: string;
  layerStatus?: string;
  layerOpinion?: string;
  layerNote?: string;
}
