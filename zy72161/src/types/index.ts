export enum ShelterStatus {
  PROCESSED = 'processed',
  PENDING_VERIFY = 'pending_verify',
  ONSITE_CHECK = 'onsite_check'
}

export enum ConflictType {
  NONE = 'none',
  CAPACITY = 'capacity',
  COORDINATE = 'coordinate',
  TIME = 'time',
  MIXED = 'mixed'
}

export interface ShelterPoint {
  id: string;
  standardName: string;
  aliases: string[];
  longitude: number;
  latitude: number;
  reportedLongitude?: number;
  reportedLatitude?: number;
  designCapacity: number;
  reportedCount: number;
  status: ShelterStatus;
  sourceIds: string[];
  conflictType: ConflictType;
  capacityByTime: Record<string, number>;
  naturalLanguageResult: string;
  createdAt: string;
  updatedAt: string;
  oldDesignCapacity?: number;
  oldCapacityYear?: string;
  newDesignCapacity?: number;
  newCapacityYear?: string;
}

export interface FeedbackSource {
  id: string;
  rawText: string;
  reporter: string;
  reportTime: string;
  locationDescription: string;
  reportedPeople: number;
  timePeriod: string;
  shelterId: string;
  isDuplicate?: boolean;
}

export interface ProcessRecord {
  id: string;
  shelterId: string;
  operator: string;
  operateTime: string;
  action: string;
  oldStatus?: ShelterStatus;
  newStatus: ShelterStatus;
  remark: string;
  supplementMaterial?: string;
}

export interface ImportData {
  id: string;
  shelterId: string;
  source: string;
  officialCapacity: number;
  importTime: string;
  dataYear: string;
}

export interface ConflictItem {
  id: string;
  shelterId: string;
  shelterName: string;
  type: ConflictType;
  severity: number;
  leftEvidence: string;
  rightEvidence: string;
  suggestion: string;
  resolved: boolean;
  resolution?: 'left' | 'right' | 'pending';
}

export const shelterStatusLabels: Record<ShelterStatus, string> = {
  [ShelterStatus.PROCESSED]: '已处理',
  [ShelterStatus.PENDING_VERIFY]: '待核实',
  [ShelterStatus.ONSITE_CHECK]: '需现场复看'
};

export const shelterStatusColors: Record<ShelterStatus, string> = {
  [ShelterStatus.PROCESSED]: 'bg-green-500',
  [ShelterStatus.PENDING_VERIFY]: 'bg-orange-500',
  [ShelterStatus.ONSITE_CHECK]: 'bg-red-500'
};

export const conflictTypeLabels: Record<ConflictType, string> = {
  [ConflictType.NONE]: '无冲突',
  [ConflictType.CAPACITY]: '容量冲突',
  [ConflictType.COORDINATE]: '坐标偏移',
  [ConflictType.TIME]: '时段冲突',
  [ConflictType.MIXED]: '多重冲突'
};

export const conflictTypeColors: Record<ConflictType, string> = {
  [ConflictType.NONE]: 'bg-gray-400',
  [ConflictType.CAPACITY]: 'bg-red-500',
  [ConflictType.COORDINATE]: 'bg-yellow-500',
  [ConflictType.TIME]: 'bg-blue-500',
  [ConflictType.MIXED]: 'bg-purple-500'
};
