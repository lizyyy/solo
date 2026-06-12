export type BoundaryStatus = 'normal' | 'pending' | 'confirmed' | 'rejected';
export type OperationType = 'import' | 'edit' | 'delete' | 'rollback' | 'review';
export type TargetType = 'busTimeSlot' | 'redlineRemark' | 'stallRotation' | 'point';
export type UserRole = 'staff' | 'manager' | 'admin';

export interface Street {
  id: string;
  name: string;
  boundary: [number, number][];
}

export interface Point {
  id: string;
  name: string;
  lng: number;
  lat: number;
  streetIds: string[];
  isBoundary: boolean;
  boundaryStatus: BoundaryStatus;
  reviewerId?: string;
  reviewerName?: string;
  reviewTime?: string;
  reviewRemark?: string;
}

export interface BusTimeSlot {
  id: string;
  routeName: string;
  date: string;
  startTime: string;
  endTime: string;
  passengerCount: number;
  relatedPointIds: string[];
  importBatchId: string;
  createdAt: string;
  updatedAt: string;
}

export interface RedlineRemark {
  id: string;
  pointId: string;
  content: string;
  version: number;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  previousId?: string;
  diff?: Record<string, { before: unknown; after: unknown }>;
}

export interface StallRotation {
  id: string;
  pointId: string;
  stallNumber: string;
  rotationDate: string;
  vendorName: string;
  status: 'active' | 'inactive';
  busTimeSlotIds: string[];
  remarkId?: string;
}

export interface OperationLog {
  id: string;
  operatorId: string;
  operatorName: string;
  operationType: OperationType;
  targetType: TargetType;
  targetId: string;
  beforeData?: unknown;
  afterData?: unknown;
  diff?: Record<string, { before: unknown; after: unknown }>;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  username: string;
}

export interface DiffResult {
  field: string;
  before: unknown;
  after: unknown;
}
