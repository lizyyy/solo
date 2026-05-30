export type BookingStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
export type ConflictType = 'ROOM_OVERLAP' | 'ENGINEER_DOUBLE' | 'MISSING_EQUIPMENT';
export type Severity = 'critical' | 'warning' | 'info';
export type ResolutionStatus = 'open' | 'resolved' | 'dismissed';
export type RoomType = 'drum' | 'vocal' | 'mixing' | 'live' | 'rehearsal';
export type SourceType = 'email' | 'chat' | 'spreadsheet' | 'phone' | 'walk_in' | 'system' | 'legacy';

export interface Provenance {
  source: SourceType;
  sourceDetail: string;
  importedAt: string;
  originalId?: string;
}

export interface Booking {
  id: string;
  clientName: string;
  roomId: string;
  engineerId?: string;
  date: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  equipmentIds: string[];
  notes: string;
  provenance: Provenance;
  createdAt: string;
  updatedAt: string;
  processingOrder: number;
}

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  equipmentIds: string[];
  provenance: Provenance;
}

export interface Engineer {
  id: string;
  name: string;
  specialties: string[];
  provenance: Provenance;
}

export interface Equipment {
  id: string;
  name: string;
  type: string;
  roomId?: string;
  quantity: number;
  provenance: Provenance;
}

export interface CustomerNote {
  id: string;
  bookingId?: string;
  clientName?: string;
  content: string;
  provenance: Provenance;
}

export interface Conflict {
  id: string;
  type: ConflictType;
  severity: Severity;
  bookingIds: string[];
  description: string;
  affectedResources: string[];
  resolutionStatus: ResolutionStatus;
  resolutionNote?: string;
  detectedAt: string;
  provenance: Provenance;
}

export interface RescheduleLog {
  id: string;
  bookingId: string;
  oldDate: string;
  oldStartTime: string;
  oldEndTime: string;
  newDate: string;
  newStartTime: string;
  newEndTime: string;
  reason: string;
  operator: string;
  timestamp: string;
}

export interface ResourceLock {
  resourceId: string;
  resourceType: 'room' | 'engineer' | 'equipment';
  bookingId: string;
  date: string;
  startTime: string;
  endTime: string;
  lockedAt: string;
}

export interface ValidationResult {
  recordId: string;
  recordType: string;
  valid: boolean;
  issues: string[];
  provenance: Provenance;
}

export interface ProcessingResult {
  bookingId: string;
  processingOrder: number;
  status: BookingStatus;
  conflicts: Conflict[];
  locks: ResourceLock[];
  reschedules: RescheduleLog[];
}

export interface Report {
  generatedAt: string;
  inputDirectory: string;
  outputDirectory: string;
  summary: {
    totalBookings: number;
    processedBookings: number;
    confirmedBookings: number;
    cancelledBookings: number;
    pendingBookings: number;
    totalConflicts: number;
    criticalConflicts: number;
    warningConflicts: number;
    roomOverlaps: number;
    engineerDoubles: number;
    missingEquipment: number;
    totalReschedules: number;
    validationErrors: number;
  };
  validationResults: ValidationResult[];
  processingResults: ProcessingResult[];
  conflicts: Conflict[];
  rescheduleLogs: RescheduleLog[];
  resourceLocks: ResourceLock[];
}
