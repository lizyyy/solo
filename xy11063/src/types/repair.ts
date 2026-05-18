export enum RepairPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
  EMERGENCY = 'emergency'
}

export enum RepairStatus {
  SUBMITTED = 'submitted',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  PENDING_PARTS = 'pending_parts',
  COMPLETED = 'completed',
  VERIFIED = 'verified',
  CANCELLED = 'cancelled'
}

export enum RepairCategory {
  PLUMBING = 'plumbing',
  ELECTRICAL = 'electrical',
  HVAC = 'hvac',
  STRUCTURAL = 'structural',
  ELEVATOR = 'elevator',
  SECURITY = 'security',
  GROUNDS = 'grounds',
  CLEANING = 'cleaning',
  OTHER = 'other'
}

export interface RepairLocation {
  building: string;
  floor: string;
  room: string;
  areaDescription?: string;
}

export interface ReporterInfo {
  name: string;
  phone: string;
  roomNumber: string;
  email?: string;
  isResident: boolean;
}

export interface RepairAssignment {
  technicianId: string;
  technicianName: string;
  assignedAt: Date;
  estimatedCompletion?: Date;
}

export interface MergeRecord {
  mergedRepairId: string;
  mergedAt: Date;
  mergedBy: string;
  reason: string;
}

export interface RepairRecord {
  id: string;
  repairNumber: string;
  title: string;
  description: string;
  category: RepairCategory;
  priority: RepairPriority;
  status: RepairStatus;
  location: RepairLocation;
  reporter: ReporterInfo;
  assignment?: RepairAssignment;
  images?: string[];
  estimatedCost?: number;
  actualCost?: number;
  mergeHistory: MergeRecord[];
  mergedInto?: string;
  isDuplicate: boolean;
  duplicateCount: number;
  relatedRepairIds: string[];
  createdAt: Date;
  updatedAt: Date;
  submittedAt: Date;
  completedAt?: Date;
  createdBy: string;
  notes: string[];
  version: number;
}

export interface CreateRepairRequest {
  title: string;
  description: string;
  category: RepairCategory;
  priority?: RepairPriority;
  location: RepairLocation;
  reporter: ReporterInfo;
  images?: string[];
  createdBy: string;
}

export interface UpdateRepairRequest {
  title?: string;
  description?: string;
  category?: RepairCategory;
  priority?: RepairPriority;
  status?: RepairStatus;
  location?: RepairLocation;
  assignment?: RepairAssignment;
  estimatedCost?: number;
  actualCost?: number;
  notes?: string;
  updatedBy: string;
  expectedVersion: number;
}

export interface MergeRepairsRequest {
  targetRepairId: string;
  sourceRepairIds: string[];
  mergedBy: string;
  reason: string;
  keepOriginalPriority?: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  details: Record<string, any>;
  timestamp: Date;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}
