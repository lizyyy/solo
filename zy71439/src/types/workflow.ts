import type { GeoPoint, BearingData, PositionMark, SelectedRoute, TriangleData, RouteOption } from './geo';

export enum WorkflowStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  RETURNED = 'returned'
}

export enum OperationType {
  BEARING_INPUT = 'bearing_input',
  BEARING_MODIFY = 'bearing_modify',
  POSITION_MARK = 'position_mark',
  POSITION_ADJUST = 'position_adjust',
  ROUTE_SELECT = 'route_select',
  SUBMIT = 'submit',
  UNIT_ERROR_DETECTED = 'unit_error_detected',
  REVIEW_APPROVE = 'review_approve',
  REVIEW_RETURN = 'review_return'
}

export interface OperationLog {
  id: string;
  recordId: string;
  actionType: OperationType;
  actionDetail: string;
  timestamp: Date;
  operator: string;
}

export interface WorkflowState {
  status: WorkflowStatus;
  reviewerId?: string;
  reviewComment?: string;
  reviewTime?: Date;
  returnReason?: string;
}

export interface TrainingRecord {
  id: string;
  traineeName: string;
  startTime: Date;
  endTime?: Date;
  scenarioId: string;
  finalError?: number;
  workflow: WorkflowState;
  operations: OperationLog[];
  bearings: Record<string, BearingData>;
  positionMark: (PositionMark & { point: GeoPoint; snappedToEstimate: boolean }) | null;
  selectedRoute: (SelectedRoute & RouteOption) | null;
  triangleData: TriangleData | null;
  estimatedPosition: GeoPoint | null;
}

export interface User {
  id: string;
  name: string;
  role: 'trainee' | 'instructor';
}

export interface WorkflowStoreState {
  currentUser: User | null;
  loginAsInstructor: () => void;
  loginAsTrainee: (name: string) => void;
  logout: () => void;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  hint: string;
  lighthouseIds: string[];
  trueShipPosition: {
    lat: number;
    lng: number;
  };
  rescueStation: {
    lat: number;
    lng: number;
    name: string;
  };
  bearingHints: {
    lighthouseId: string;
    bearing: number;
    unit: 'dms' | 'decimal';
  }[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}
