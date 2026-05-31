export type TaskStatus = 'waiting_artworks' | 'pending' | 'reviewing' | 'completed';

export interface Task {
  id: string;
  source: string;
  sourceHash: string;
  title: string;
  curatorNote: string;
  status: TaskStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  pendingReason?: string;
  executionCount: number;
}

export interface StatusHistory {
  id: string;
  taskId: string;
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus;
  operator: string;
  operatedAt: string;
  remark?: string;
}

export interface Artwork {
  id: string;
  taskId: string;
  title: string;
  artist: string;
  size: string;
  positionX: number;
  positionY: number;
  wallId: string;
  version: number;
  createdAt: string;
}

export interface WallLayout {
  id: string;
  taskId: string;
  version: number;
  layoutData: {
    walls: Wall[];
  };
  modifiedBy: string;
  modifiedAt: string;
  changeNote: string;
}

export interface Wall {
  id: string;
  name: string;
  width: number;
  height: number;
  artworks: WallArtwork[];
}

export interface WallArtwork {
  artworkId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OperationLog {
  id: string;
  taskId: string;
  operator: string;
  action: 'create' | 'update' | 'delete';
  fieldName: string;
  oldValue?: string;
  newValue?: string;
  operatedAt: string;
}

export interface User {
  id: string;
  name: string;
  role: 'curator' | 'assistant';
  avatar?: string;
}

export interface ConsistencyCheckResult {
  isConsistent: boolean;
  issues: ConsistencyIssue[];
}

export interface ConsistencyIssue {
  type: 'missing_in_layout' | 'missing_in_list' | 'position_mismatch';
  artworkId: string;
  artworkTitle: string;
  message: string;
  severity: 'warning' | 'error';
}
