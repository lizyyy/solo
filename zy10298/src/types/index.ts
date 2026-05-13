export type BoothStatus = 
  | 'pending_approval'
  | 'material_review'
  | 'electricity_approved'
  | 'deposit_paid'
  | 'setup_confirmed'
  | 'in_use'
  | 'teardown_pending'
  | 'teardown_approved'
  | 'completed'
  | 'rejected';

export type MaterialStatus = 'pending' | 'approved' | 'rejected';
export type ElectricityStatus = 'pending' | 'approved' | 'rejected' | 'exceeded';
export type DepositStatus = 'unpaid' | 'paid' | 'refund_pending' | 'refunded' | 'deducted';
export type TeardownStatus = 'pending' | 'inspecting' | 'passed' | 'failed';

export interface Brand {
  id: string;
  name: string;
  contactPerson: string;
  contactPhone: string;
  email: string;
}

export interface Booth {
  id: string;
  code: string;
  name: string;
  location: string;
  area: number;
  maxElectricity: number;
  basePrice: number;
}

export interface MaterialItem {
  id: string;
  name: string;
  type: string;
  quantity: number;
  fireCertified: boolean;
  status: MaterialStatus;
  reviewRemark?: string;
}

export interface ElectricityApplication {
  id: string;
  appliedPower: number;
  status: ElectricityStatus;
  approvedPower?: number;
  reviewRemark?: string;
}

export interface Deposit {
  id: string;
  amount: number;
  status: DepositStatus;
  paidAt?: string;
  refundedAt?: string;
  deductionAmount?: number;
  deductionReason?: string;
}

export interface TeardownInspection {
  id: string;
  status: TeardownStatus;
  groundScratches: boolean;
  damageDescription?: string;
  repairCost?: number;
  inspectedAt?: string;
  inspector?: string;
}

export interface BoothApplication {
  id: string;
  applicationNo: string;
  brandId: string;
  brandName: string;
  boothId: string;
  boothCode: string;
  boothName: string;
  boothLocation: string;
  startDate: string;
  endDate: string;
  status: BoothStatus;
  materials: MaterialItem[];
  electricity: ElectricityApplication;
  deposit: Deposit;
  teardown: TeardownInspection;
  purpose: string;
  estimatedSetupDate: string;
  estimatedTeardownDate: string;
  createdAt: string;
  updatedAt: string;
  hasScheduleConflict: boolean;
  hasMaterialIssue: boolean;
  hasElectricityIssue: boolean;
  hasDepositIssue: boolean;
  hasTeardownIssue: boolean;
  currentStep: number;
}

export interface StatsData {
  totalApplications: number;
  pendingApproval: number;
  pendingTeardown: number;
  pendingDeduction: number;
  inProgress: number;
  completed: number;
  issues: number;
}

export interface FilterParams {
  status?: BoothStatus;
  brandName?: string;
  boothCode?: string;
  startDate?: string;
  endDate?: string;
  hasIssues?: boolean;
}
