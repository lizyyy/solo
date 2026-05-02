import { BloodType, BloodComponentType, ApplicationStatus } from './common';

export interface Application {
  id: string;
  wardId: string;
  patientName: string;
  patientId: string;
  bloodType: BloodType;
  componentType: BloodComponentType;
  quantity: number;
  urgency: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
  clinicalDiagnosis: string;
  specialRequirements: string | null;
  crossMatchRequired: boolean;
  status: ApplicationStatus;
  matchedBloodBagIds: string[];
  reservedBloodBagIds: string[];
  issuedBloodBagIds: string[];
  requestedBy: string;
  requestedAt: string;
  matchedAt: string | null;
  reservedAt: string | null;
  issuedAt: string | null;
  cancelledAt: string | null;
  rejectedReason: string | null;
  notes: string | null;
}

export interface CreateApplicationInput {
  wardId: string;
  patientName: string;
  patientId: string;
  bloodType: BloodType;
  componentType: BloodComponentType;
  quantity: number;
  urgency: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
  clinicalDiagnosis: string;
  specialRequirements?: string;
  crossMatchRequired: boolean;
  requestedBy: string;
  notes?: string;
}

export interface MatchResult {
  applicationId: string;
  matchedBags: MatchedBloodBag[];
  score: number;
  canFulfill: boolean;
  missingQuantity: number;
  warnings: string[];
}

export interface MatchedBloodBag {
  bloodBagId: string;
  bloodType: BloodType;
  componentType: BloodComponentType;
  expiryDate: string;
  hoursUntilExpiry: number;
  crossMatchStatus: string;
  hasTemperatureAnomaly: boolean;
  matchScore: number;
  matchReason: string;
}
