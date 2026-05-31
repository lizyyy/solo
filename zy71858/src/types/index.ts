export type RecordStatus = 'pending' | 'confirmed' | 'to_supplement' | 'modified';

export interface SunshineRecord {
  id: string;
  buildingId: string;
  buildingName: string;
  floor: number;
  roomNumber: string;
  source: string;
  sourceType: 'import' | 'manual';
  importTime: string;
  importer: string;
  status: RecordStatus;
  currentHandler: string;
  pendingReason?: string;
  isManualModified: boolean;
  lastModified: string;
  lastModifier: string;
  remark?: string;
}

export interface StatusHistory {
  id: string;
  recordId: string;
  fromStatus: RecordStatus | null;
  toStatus: RecordStatus;
  reason: string;
  operator: string;
  operateTime: string;
  remark?: string;
}

export interface BuildingModel {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  dimensions: { height: number; width: number; depth: number };
  color: string;
}

export interface AppState {
  records: SunshineRecord[];
  buildings: BuildingModel[];
  histories: StatusHistory[];
  currentUser: string;
  selectedBuildingId: string | null;
  selectedRecordId: string | null;
  sunTime: number;
}
