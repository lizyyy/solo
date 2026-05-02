import { BloodType, BloodComponentType, BloodBagStatus, TemperatureRecord } from './common';

export interface BloodBag {
  id: string;
  bloodType: BloodType;
  componentType: BloodComponentType;
  volume: number;
  donorId: string;
  collectionDate: string;
  expiryDate: string;
  crossMatchStatus: 'PENDING' | 'COMPATIBLE' | 'INCOMPATIBLE' | 'NOT_REQUIRED';
  temperatureRecords: TemperatureRecord[];
  status: BloodBagStatus;
  lockedBy: string | null;
  lockedUntil: string | null;
  reservedForApplicationId: string | null;
  issuedToWardId: string | null;
  issuedAt: string | null;
  receivedAt: string;
  lastUpdatedAt: string;
  notes: string | null;
}

export interface CreateBloodBagInput {
  bloodType: BloodType;
  componentType: BloodComponentType;
  volume: number;
  donorId: string;
  collectionDate: string;
  expiryDate: string;
  crossMatchStatus?: 'PENDING' | 'COMPATIBLE' | 'INCOMPATIBLE' | 'NOT_REQUIRED';
  initialTemperature?: number;
  notes?: string;
}

export interface UpdateBloodBagInput {
  crossMatchStatus?: 'PENDING' | 'COMPATIBLE' | 'INCOMPATIBLE' | 'NOT_REQUIRED';
  notes?: string;
}

export interface AddTemperatureRecordInput {
  bloodBagId: string;
  temperature: number;
  location: string;
}

export interface BloodBagFilter {
  bloodType?: BloodType;
  componentType?: BloodComponentType;
  status?: BloodBagStatus;
  isExpiringSoon?: boolean;
  expiringWithinHours?: number;
  crossMatchStatus?: 'PENDING' | 'COMPATIBLE' | 'INCOMPATIBLE' | 'NOT_REQUIRED';
  hasTemperatureAnomaly?: boolean;
}

export interface TemperatureAnomalyInfo {
  hasAnomaly: boolean;
  anomalies: {
    record: TemperatureRecord;
    reason: string;
  }[];
}
