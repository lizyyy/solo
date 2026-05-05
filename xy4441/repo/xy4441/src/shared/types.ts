export interface SceneSchedule {
  id: string;
  sceneNumber: string;
  sceneName: string;
  shootDate: string;
  location: string;
  characters: string[];
  dayNight: string;
  weather: string;
  notes?: string;
}

export interface CostumeItem {
  id: string;
  barcode: string;
  character: string;
  itemName: string;
  size: string;
  color: string;
  scenes: string[];
  status: 'available' | 'in_wash' | 'in_alteration' | 'checked_out' | 'lost';
  lastUpdated: string;
  notes?: string;
}

export interface WashRecord {
  id: string;
  costumeId: string;
  barcode: string;
  washDate: string;
  expectedReturnDate: string;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed';
  notes?: string;
}

export interface AlterationRecord {
  id: string;
  costumeId: string;
  barcode: string;
  changeType: string;
  currentSize: string;
  targetSize: string;
  requestDate: string;
  expectedCompletion: string;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed';
  isConfirmed: boolean;
  notes?: string;
}

export interface ReferencePhoto {
  id: string;
  filePath: string;
  fileName: string;
  sceneNumber: string;
  character: string;
  barcode: string;
  photoType: 'continuity' | 'detail' | 'fit';
  takenDate: string;
  notes?: string;
}

export type RiskType = 
  | 'missing_item' 
  | 'wash_conflict' 
  | 'size_unconfirmed' 
  | 'photo_mismatch'
  | 'alteration_delay';

export interface RiskItem {
  id: string;
  type: RiskType;
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  sceneNumber?: string;
  character?: string;
  barcode?: string;
  costumeId?: string;
  affectedDate?: string;
  isResolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  userOverride?: 'ignore' | 'pending' | 'resolved';
  userNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  lastScannedAt?: string;
}

export interface ImportResult<T> {
  success: boolean;
  data?: T[];
  errors?: string[];
  count: number;
}

export interface ExportOptions {
  format: 'markdown' | 'json';
  includeResolved: boolean;
  includeNotes: boolean;
}

export interface DatabaseSettings {
  dbPath: string;
  autoBackup: boolean;
  backupInterval: number;
}
