export enum PlanStatus {
  RUNNING = '投放中',
  STOPPING = '止损中',
  PENDING_COMPENSATION = '待补偿',
  CLOSED = '已关闭'
}

export enum FlowType {
  NORMAL = '正常流',
  REJECT = '驳回流',
  MANUAL_REVIEW = '人工复核流'
}

export enum ReviewResult {
  APPROVED = '通过',
  REJECTED = '驳回'
}

export interface Advertiser {
  id: string;
  name: string;
  companyName: string;
  industry: string;
  contactPerson: string;
  contactPhone: string;
  totalBudget: number;
  usedBudget: number;
  createdAt: Date;
}

export interface AdPlan {
  id: string;
  advertiserId: string;
  name: string;
  platform: string;
  dailyBudget: number;
  totalBudget: number;
  currentSpend: number;
  status: PlanStatus;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SpendCallback {
  id: string;
  planId: string;
  spendAmount: number;
  callbackTime: Date;
  callbackSource: string;
  isDelayed: boolean;
  createdAt: Date;
}

export interface ReviewRecord {
  id: string;
  planId: string;
  flowType: FlowType;
  operatorId: string;
  operatorName: string;
  reviewResult: ReviewResult;
  reason: string;
  evidenceUrls: string[];
  createdAt: Date;
}

export interface ImportResult {
  success: boolean;
  rowNumber: number;
  planId?: string;
  errorMessage?: string;
}

export interface ExportData {
  plan: AdPlan;
  advertiser: Advertiser;
  spendCallbacks: SpendCallback[];
  reviewRecords: ReviewRecord[];
}
