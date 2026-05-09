export enum RefundStatus {
  PENDING = 'PENDING',
  CALCULATED = 'CALCULATED',
  APPROVED = 'APPROVED',
  CALLBACK_SENT = 'CALLBACK_SENT',
  RECONCILED = 'RECONCILED',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
}

export enum RejectStage {
  VALIDATION = 'VALIDATION',
  CALCULATION = 'CALCULATION',
  APPROVAL = 'APPROVAL',
  CALLBACK = 'CALLBACK',
  RECONCILIATION = 'RECONCILIATION',
}

export enum InterruptionReason {
  USER_STOP = 'USER_STOP',
  EQUIPMENT_FAULT = 'EQUIPMENT_FAULT',
  NETWORK_DISCONNECT = 'NETWORK_DISCONNECT',
  POWER_QUALITY = 'POWER_QUALITY',
  VEHICLE_ISSUE = 'VEHICLE_ISSUE',
}

export enum ChargeType {
  FAST = 'FAST',
  SLOW = 'SLOW',
  ULTRA_FAST = 'ULTRA_FAST',
}

export interface ChargingSession {
  id: string;
  userId: string;
  stationId: string;
  connectorId: string;
  chargeType: ChargeType;
  startTime: Date;
  endTime: Date | null;
  totalRequestedKwh: number;
  status: 'ACTIVE' | 'INTERRUPTED' | 'COMPLETED';
}

export interface BillingSegment {
  id: string;
  sessionId: string;
  segmentType: 'ENERGY' | 'SERVICE';
  startTime: Date;
  endTime: Date;
  actualKwh: number;
  rateId: string;
  unitPrice: number;
  amount: number;
  isRefundable: boolean;
  refundPercentage: number;
}

export interface RefundRequest {
  id: string;
  sessionId: string;
  requestId: string;
  interruptionReason: InterruptionReason;
  interruptionTime: Date;
  description: string;
  createdAt: Date;
}

export interface RefundRecord {
  id: string;
  requestId: string;
  sessionId: string;
  status: RefundStatus;
  currentStage: RejectStage | null;
  energyRefundAmount: number;
  serviceRefundAmount: number;
  totalRefundAmount: number;
  callbackCount: number;
  lastCallbackAt: Date | null;
  lastCallbackResponse: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RefundHistory {
  id: string;
  refundRecordId: string;
  status: RefundStatus;
  stage: RejectStage | null;
  message: string;
  operator: string;
  createdAt: Date;
}

export interface RefundCalculation {
  energyAmount: number;
  serviceAmount: number;
  totalAmount: number;
  energySegments: RefundSegmentDetail[];
  serviceSegments: RefundSegmentDetail[];
}

export interface RefundSegmentDetail {
  segmentId: string;
  originalAmount: number;
  refundPercentage: number;
  refundAmount: number;
  reason: string;
}

export interface RefundResult {
  success: boolean;
  refundRecord?: RefundRecord;
  currentStage?: RejectStage;
  message: string;
}
