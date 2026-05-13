export enum TemperatureBoxStatus {
  CREATED = 'created',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  EXCHANGED = 'exchanged'
}

export enum HandoverStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  REJECTED = 'rejected'
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum SignOffResult {
  SUCCESS = 'success',
  BLOCKED = 'blocked',
  NEEDS_REVIEW = 'needs_review',
  DUPLICATE = 'duplicate'
}

export interface TemperatureBox {
  id: string;
  boxCode: string;
  orderId: string;
  medicineName: string;
  minTemp: number;
  maxTemp: number;
  currentTemp: number;
  status: TemperatureBoxStatus;
  createdAt: string;
  createdBy: string;
}

export interface RiderHandover {
  id: string;
  boxId: string;
  riderId: string;
  riderName: string;
  fromRiderId?: string;
  fromRiderName?: string;
  status: HandoverStatus;
  handoverTime: string;
  confirmedTime?: string;
  location: string;
  temperatureAtHandover: number;
  notes?: string;
}

export interface GPSNode {
  id: string;
  boxId: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  temperature: number;
  batteryLevel: number;
}

export interface SignOffPerson {
  id: string;
  name: string;
  phone: string;
  idCard: string;
  authorized: boolean;
  department: string;
}

export interface DelayExchange {
  id: string;
  boxId: string;
  oldBoxId?: string;
  reason: string;
  reasonType: string;
  delayMinutes: number;
  changedBy: string;
  changedAt: string;
  affectedRecordIds: string[];
  reviewedBy?: string;
  reviewedAt?: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface RiskAssessment {
  id: string;
  boxId: string;
  level: RiskLevel;
  score: number;
  factors: string[];
  assessedAt: string;
  assessedBy: string;
}

export interface OperationLog {
  id: string;
  operationType: string;
  entityType: string;
  entityId: string;
  operatorId: string;
  operatorName: string;
  operateTime: string;
  beforeValue?: any;
  afterValue?: any;
  remarks?: string;
}

export interface SignOffRequest {
  boxId: string;
  signOffPersonId: string;
  signOffTime: string;
  temperature: number;
  location: string;
  operatorId: string;
  operatorName: string;
}

export interface SignOffResponse {
  success: boolean;
  result: SignOffResult;
  message: string;
  riskLevel?: RiskLevel;
  blockedReasons?: string[];
}
