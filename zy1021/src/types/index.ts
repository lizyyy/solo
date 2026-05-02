export interface InspectionItem {
  id: string;
  name: string;
  riskLevel: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed';
  notes: string;
  photoPlaceholder: string;
  lastModifiedBy: string;
  lastModifiedAt: number;
}

export interface InspectionForm {
  id: string;
  title: string;
  items: InspectionItem[];
  createdAt: number;
  createdBy: string;
}

export interface VersionInfo {
  version: number;
  timestamp: number;
  modifiedBy: string;
}

export interface ChangeSet {
  id: string;
  formId: string;
  itemId: string;
  field: keyof InspectionItem;
  oldValue: unknown;
  newValue: unknown;
  version: number;
  timestamp: number;
  deviceId: string;
  userId: string;
}

export enum ConflictType {
  NO_CONFLICT = 'no_conflict',
  SAME_FIELD_CONFLICT = 'same_field_conflict',
  OLD_VERSION_SUBMIT = 'old_version_submit'
}

export interface Conflict {
  id: string;
  type: ConflictType;
  serverChange: ChangeSet;
  clientChange: ChangeSet;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: number;
  selectedValue?: unknown;
}

export interface SyncLogEntry {
  id: string;
  timestamp: number;
  type: 'change' | 'sync' | 'conflict' | 'resolve';
  deviceId: string;
  userId: string;
  description: string;
  details?: Record<string, unknown>;
}

export interface DeviceState {
  id: string;
  name: string;
  userId: string;
  isOnline: boolean;
  localVersion: number;
  pendingChanges: ChangeSet[];
  localForm: InspectionForm;
}

export interface ServerState {
  currentVersion: number;
  form: InspectionForm;
  changeHistory: ChangeSet[];
  conflicts: Conflict[];
}

export interface AppState {
  devices: DeviceState[];
  server: ServerState;
  logs: SyncLogEntry[];
}

export interface PresetScene {
  name: string;
  description: string;
  initialState: AppState;
}
