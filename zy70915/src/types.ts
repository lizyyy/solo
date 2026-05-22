export enum ClaimCategory {
  NORMAL = 'normal',
  PENDING_SUPPLEMENT = 'pending_supplement',
  BLOCKED = 'blocked'
}

export enum Responsibility {
  AIRLINE = 'airline',
  AIRPORT = 'airport',
  TRANSFER = 'transfer',
  UNKNOWN = 'unknown'
}

export interface PhotoEvidence {
  url: string;
  timestamp: Date;
  description: string;
}

export interface BaggageInfo {
  tagNumber: string;
  airline: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  arrivalDate: Date;
}

export interface ClaimInput {
  baggage: BaggageInfo;
  passengerName: string;
  passengerPhone: string;
  damageDescription: string;
  photos: PhotoEvidence[];
  estimatedValue: number;
  submittedBy: string;
  responsibility: Responsibility;
}

export interface Claim extends ClaimInput {
  id: string;
  category: ClaimCategory;
  categoryReason: string;
  nextAction: string;
  submitTime: Date;
  updateTime: Date;
  isDuplicate: boolean;
  originalClaimId?: string;
  reportGenerated?: boolean;
  timeLimitExceeded?: boolean;
  timeLimitReason?: string;
}

export interface AuditLog {
  id: string;
  claimId: string;
  modifiedBy: string;
  modifyTime: Date;
  fieldName: string;
  oldValue: any;
  newValue: any;
  reason: string;
}

export interface CategoryResult {
  category: ClaimCategory;
  reason: string;
  nextAction: string;
}
