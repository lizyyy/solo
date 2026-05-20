import { v4 as uuidv4 } from 'uuid';

export enum SampleStatus {
  PENDING = 'pending',
  SHIPPED = 'shipped',
  RETURNED = 'returned',
  DAMAGED = 'damaged',
  LOST = 'lost',
  OVERDUE = 'overdue'
}

export enum DiscrepancyType {
  OVERDUE_NOT_RETURNED = 'overdue_not_returned',
  DAMAGED_DEDUCTION = 'damaged_deduction',
  DUPLICATE_SHIPMENT = 'duplicate_shipment',
  MANUAL_CORRECTION = 'manual_correction'
}

export enum ReviewStatus {
  PENDING_REVIEW = 'pending_review',
  REVIEWED = 'reviewed',
  CONFIRMED = 'confirmed'
}

export interface Influencer {
  id: string;
  name: string;
  platform: string;
  followers: number;
  contact: string;
  depositAmount: number;
}

export interface ShipmentItem {
  id: string;
  shipmentId: string;
  sampleCode: string;
  sampleName: string;
  quantity: number;
  unitValue: number;
  totalValue: number;
}

export interface Shipment {
  id: string;
  batchCode: string;
  batchName: string;
  brand: string;
  influencerId: string;
  influencerName: string;
  shipDate: string;
  dueDate: string;
  returnDate?: string;
  status: SampleStatus;
  items: ShipmentItem[];
  totalValue: number;
  photoProof?: string[];
  notes?: string;
}

export interface Discrepancy {
  id: string;
  shipmentId: string;
  type: DiscrepancyType;
  description: string;
  amount: number;
  source: string;
  isResolved: boolean;
  resolution?: string;
}

export interface ReconciliationRecord {
  id: string;
  shipmentId: string;
  batchCode: string;
  influencerName: string;
  sampleName: string;
  sampleCode: string;
  originalStatus: SampleStatus;
  currentStatus: SampleStatus;
  discrepancies: Discrepancy[];
  reviewStatus: ReviewStatus;
  reviewer?: string;
  reviewTime?: string;
  reviewNotes?: string;
  deductionAmount: number;
  isModified: boolean;
}

export function getPrimaryDiscrepancy(record: ReconciliationRecord): Discrepancy | undefined {
  return record.discrepancies.length > 0 ? record.discrepancies[0] : undefined;
}

export function getAllDiscrepancyTypes(record: ReconciliationRecord): string {
  return record.discrepancies.map(d => d.type).join('; ');
}

export function getAllDiscrepancyDescriptions(record: ReconciliationRecord): string {
  return record.discrepancies.map(d => d.description).join(' | ');
}

export interface ReconciliationSummary {
  totalShipments: number;
  returnedOnTime: number;
  overdue: number;
  damaged: number;
  lost: number;
  totalDeduction: number;
  pendingReview: number;
  reviewed: number;
}

export interface ReconciliationReport {
  reportId: string;
  generatedAt: string;
  batchCode: string;
  summary: ReconciliationSummary;
  records: ReconciliationRecord[];
  discrepancies: Discrepancy[];
}

export function generateId(): string {
  return uuidv4();
}
