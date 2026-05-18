export enum QuoteStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  CUSTOMER_ACCEPTED = 'CUSTOMER_ACCEPTED',
  PENDING_SUPPLEMENT = 'PENDING_SUPPLEMENT',
  REJECTED = 'REJECTED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum ChangeType {
  HIDDEN_FAULT_ADD = 'HIDDEN_FAULT_ADD',
  PRICE_ADJUSTMENT = 'PRICE_ADJUSTMENT',
  PART_CHANGE = 'PART_CHANGE',
  LABOR_ADJUSTMENT = 'LABOR_ADJUSTMENT'
}

export enum ReviewResult {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
}

export interface Vehicle {
  id: string;
  plateNumber: string;
  brand: string;
  model: string;
  year: number;
  mileage: number;
  vin: string;
}

export interface FaultItem {
  id: string;
  description: string;
  category: string;
  isHidden: boolean;
  laborCost: number;
}

export interface PartItem {
  id: string;
  name: string;
  partNumber: string;
  quantity: number;
  unitPrice: number;
  isOriginal: boolean;
}

export interface QuoteChangeRecord {
  id: string;
  quoteId: string;
  changeType: ChangeType;
  changeReason: string;
  previousAmount: number;
  newAmount: number;
  changedBy: string;
  changedAt: Date;
  reviewResult: ReviewResult;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
}

export interface RepairQuote {
  id: string;
  quoteNumber: string;
  stationId: string;
  stationName: string;
  technician: string;
  technicianPhone: string;
  customer: Customer;
  vehicle: Vehicle;
  appointmentTime: Date;
  arrivalTime?: Date;
  faultItems: FaultItem[];
  partItems: PartItem[];
  laborTotal: number;
  partsTotal: number;
  discount: number;
  totalAmount: number;
  status: QuoteStatus;
  statusHistory: {
    status: QuoteStatus;
    changedAt: Date;
    changedBy: string;
    notes?: string;
  }[];
  customerAcceptedAt?: Date;
  rejectionReason?: string;
  supplementNotes?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
    suggestedAction?: string;
  };
}
