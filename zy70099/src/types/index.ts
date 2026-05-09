export enum BatteryStatus {
  CHARGING = 'CHARGING',
  AVAILABLE = 'AVAILABLE',
  LENT = 'LENT',
  MAINTENANCE = 'MAINTENANCE',
  SCRAPPED = 'SCRAPPED',
}

export enum SlotStatus {
  EMPTY = 'EMPTY',
  OCCUPIED = 'OCCUPIED',
  MAINTENANCE = 'MAINTENANCE',
}

export enum TransactionType {
  LEND = 'LEND',
  RETURN = 'RETURN',
}

export enum TransactionStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  PENDING_REVIEW = 'PENDING_REVIEW',
}

export enum ExceptionType {
  STATE_MISMATCH = 'STATE_MISMATCH',
  SLOT_MISMATCH = 'SLOT_MISMATCH',
  BATTERY_NOT_FOUND = 'BATTERY_NOT_FOUND',
  SLOT_NOT_FOUND = 'SLOT_NOT_FOUND',
  INVALID_TRANSITION = 'INVALID_TRANSITION',
  CYCLE_COUNT_EXCEEDED = 'CYCLE_COUNT_EXCEEDED',
  MAINTENANCE_VIOLATION = 'MAINTENANCE_VIOLATION',
  UNEXPECTED_EMPTY = 'UNEXPECTED_EMPTY',
  UNEXPECTED_OCCUPIED = 'UNEXPECTED_OCCUPIED',
  CONFLICTING_TRANSACTION = 'CONFLICTING_TRANSACTION',
}

export interface Battery {
  id: string;
  batteryCode: string;
  status: BatteryStatus;
  cycleCount: number;
  maxCycleCount: number;
  currentSlotId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CabinetSlot {
  id: string;
  cabinetId: string;
  slotNumber: number;
  status: SlotStatus;
  batteryId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  batteryCode: string;
  userId: string;
  cabinetId: string;
  slotNumber: number;
  status: TransactionStatus;
  createdAt: string;
  completedAt: string | null;
}

export interface ExceptionRecord {
  id: string;
  type: ExceptionType;
  relatedTransactionId: string | null;
  batteryCode: string | null;
  slotId: string | null;
  details: Record<string, any>;
  message: string;
  isResolved: boolean;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface PendingTask {
  id: string;
  type: 'MANUAL_REVIEW' | 'BATTERY_INSPECTION' | 'SLOT_CLEANUP';
  relatedEntityId: string;
  relatedEntityType: 'BATTERY' | 'SLOT' | 'TRANSACTION';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  details: Record<string, any>;
  isHandled: boolean;
  handledBy: string | null;
  handledAt: string | null;
  createdAt: string;
}

export interface LendRequest {
  batteryCode: string;
  userId: string;
  cabinetId: string;
  slotNumber: number;
}

export interface ReturnRequest {
  batteryCode: string;
  userId: string;
  cabinetId: string;
  slotNumber: number;
}

export interface MaintenanceRequest {
  batteryCode: string;
  reason: string;
}

export interface ScrapRequest {
  batteryCode: string;
  reason: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    exceptionId?: string;
    pendingTaskId?: string;
  };
}
