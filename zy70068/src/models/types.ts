export interface Stop {
  id: string;
  name: string;
  order: number;
  latitude?: number;
  longitude?: number;
}

export interface LineVersion {
  id: string;
  lineId: string;
  lineName: string;
  version: number;
  stops: Stop[];
  effectiveFrom: Date;
  effectiveTo?: Date;
  createdAt: Date;
}

export type DetourStatus = 'PENDING' | 'ACTIVE' | 'RESOLVED' | 'CANCELLED' | 'CONFLICT';

export type DetourReason = 'CONSTRUCTION' | 'ACCIDENT' | 'WEATHER' | 'OTHER';

export interface DetourEvent {
  id: string;
  lineId: string;
  lineVersionId: string;
  reason: DetourReason;
  description: string;
  affectedStopIds: string[];
  alternativeStopIds: string[];
  status: DetourStatus;
  reportedBy: string;
  reportedAt: Date;
  startTime?: Date;
  endTime?: Date;
  priority: number;
  conflictWith?: string[];
}

export type EtaSource = 'NORMAL' | 'DETOUR' | 'LIVE';

export interface StopEta {
  id: string;
  stopId: string;
  lineId: string;
  detourEventId?: string;
  estimatedArrival: Date;
  actualArrival?: Date;
  source: EtaSource;
  createdAt: Date;
  expiresAt: Date;
}

export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED';

export interface Notification {
  id: string;
  parentId: string;
  stopId: string;
  lineId: string;
  detourEventId?: string;
  type: 'ETA_UPDATE' | 'DETOUR_START' | 'DETOUR_END' | 'DETOUR_CANCELLED';
  content: string;
  deduplicationKey: string;
  status: NotificationStatus;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: Date;
  sentAt?: Date;
  createdAt: Date;
}

export type ReceiptStatus = 'PENDING' | 'ACKNOWLEDGED' | 'REJECTED' | 'TIMED_OUT';

export interface DriverReceipt {
  id: string;
  driverId: string;
  detourEventId: string;
  status: ReceiptStatus;
  acknowledgedAt?: Date;
  rejectedReason?: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface RunReport {
  id: string;
  date: string;
  lineId: string;
  lineVersionId: string;
  totalStops: number;
  completedStops: number;
  detourEvents: {
    eventId: string;
    reason: DetourReason;
    status: DetourStatus;
    affectedStops: string[];
  }[];
  notifications: {
    total: number;
    sent: number;
    failed: number;
    deduplicated: number;
  };
  driverReceipts: {
    total: number;
    acknowledged: number;
    rejected: number;
    timedOut: number;
  };
  generatedAt: Date;
}

export interface ParentSubscription {
  parentId: string;
  lineId: string;
  stopId: string;
  childName: string;
  isActive: boolean;
}
