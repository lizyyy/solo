export type FileType = 'video' | 'subtitle' | 'archive';

export type ItemStatus = 'pending' | 'reviewed' | 'delivered' | 'missing';

export interface ArchiveItem {
  id: string;
  name: string;
  version: string;
  videoPath: string | null;
  subtitlePath: string | null;
  archivePath: string | null;
  status: ItemStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
  deliveredAt: string | null;
  clientName: string;
}

export interface HistoryRecord {
  id: string;
  itemId: string;
  itemName: string;
  action: string;
  timestamp: string;
  details: string;
}

export interface AppState {
  items: ArchiveItem[];
  history: HistoryRecord[];
}

export interface ValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
}
