export type BusinessDataType =
  | 'invoice'
  | 'confirmation'
  | 'contract'
  | 'repayment_plan'
  | 'collection_note'
  | 'risk_report';

export type UserRole =
  | 'risk_officer'
  | 'collection_officer'
  | 'supervisor'
  | 'admin';

export type CaseStatus =
  | 'pending_confirmation'
  | 'confirmed'
  | 'confirmation_failed'
  | 'normal_repayment'
  | 'overdue'
  | 'in_collection'
  | 'in_negotiation'
  | 'legal_action'
  | 'in_repayment'
  | 'settled'
  | 'confirmation_withdrawn'
  | 're_overdue';

export type TransitionType = 'normal' | 'reverse' | 'exception';

export type WriteOffStatus = 'pending' | 'partial' | 'full';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type CollectionMethod = 'phone' | 'email' | 'visit' | 'legal' | 'other';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  status: string;
  createdAt: string;
}

export interface BusinessCase {
  id: string;
  businessNo: string;
  buyerName: string;
  sellerName: string;
  totalAmount: number;
  financingAmount: number;
  currentStatus: CaseStatus;
  overdueDays: number;
  riskLevel: RiskLevel;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  businessNo: string;
  invoiceNo: string;
  sellerName: string;
  amount: number;
  taxAmount: number;
  goodsDescription: string;
  issueDate: string;
  dueDate: string;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface Confirmation {
  id: string;
  businessNo: string;
  confirmDate: string;
  confirmAmount: number;
  goodsReceived: boolean;
  qualityIssue: boolean;
  qualityIssueDesc: string;
  confirmer: string;
  isWithdrawn: boolean;
  withdrawReason: string;
  withdrawDate: string;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface FactoringContract {
  id: string;
  businessNo: string;
  contractNo: string;
  factoringRate: number;
  financingAmount: number;
  startDate: string;
  endDate: string;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface RepaymentPlan {
  id: string;
  businessNo: string;
  instalmentNo: number;
  principal: number;
  interest: number;
  plannedDate: string;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionNote {
  id: string;
  businessNo: string;
  collectionDate: string;
  collector: string;
  collectionMethod: CollectionMethod;
  contactPerson: string;
  contactResult: string;
  nextAction: string;
  followUpDate: string;
  createdAt: string;
}

export interface RiskReport {
  id: string;
  businessNo: string;
  riskLevel: RiskLevel;
  reportDate: string;
  analyst: string;
  keyFindings: string;
  recommendations: string;
  createdAt: string;
}

export interface StateTransition {
  id: string;
  businessNo: string;
  fromStatus: CaseStatus;
  toStatus: CaseStatus;
  transitionType: TransitionType;
  reason: string;
  impactScope: string;
  nextStep: string;
  operatorId: string;
  operatorName: string;
  timestamp: string;
}

export interface Repayment {
  id: string;
  businessNo: string;
  repaymentDate: string;
  totalAmount: number;
  principalPaid: number;
  interestPaid: number;
  penaltyPaid: number;
  payer: string;
  remark: string;
  writeOffStatus: WriteOffStatus;
  createdAt: string;
}

export interface RepaymentWriteOff {
  id: string;
  repaymentId: string;
  targetType: string;
  targetId: string;
  amount: number;
  createdAt: string;
}

export interface VersionHistory {
  id: string;
  recordId: string;
  recordType: BusinessDataType;
  version: number;
  beforeData: string;
  afterData: string;
  changedFields: string;
  operatorId: string;
  operatorName: string;
  changeReason: string;
  timestamp: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  targetType: string;
  targetId: string;
  ipAddress: string;
  userAgent: string;
  detail: string;
  timestamp: string;
}

export interface BusinessLink {
  id: string;
  sourceId: string;
  sourceType: BusinessDataType;
  targetId: string;
  targetType: BusinessDataType;
  linkType: string;
  confidence: number;
  createdAt: string;
}

export interface LinkGraphNode {
  id: string;
  type: BusinessDataType | 'case';
  name: string;
  amount?: number;
  status?: string;
  date?: string;
}

export interface LinkGraphLink {
  source: string;
  target: string;
  linkType: string;
  confidence: number;
}

export interface LinkGraph {
  nodes: LinkGraphNode[];
  links: LinkGraphLink[];
}

export interface CaseDetail {
  caseInfo: BusinessCase;
  invoice: Invoice | null;
  confirmation: Confirmation | null;
  contract: FactoringContract | null;
  repaymentPlans: RepaymentPlan[];
  collectionNotes: CollectionNote[];
  riskReports: RiskReport[];
  transitions: StateTransition[];
  repayments: Repayment[];
}

export interface VersionDiff {
  field: string;
  before: any;
  after: any;
  changeType: 'added' | 'removed' | 'modified';
}

export interface VersionCompareResult {
  diffs: VersionDiff[];
  before: Record<string, any>;
  after: Record<string, any>;
}

export interface RegressionAnalysis {
  businessNo: string;
  regressionType: 'confirmation_withdrawn' | 'status_reverse' | 'payment_revoked';
  analysis: string;
  impactScope: string[];
  suggestions: string[];
  affectedAmount: number;
}

export interface RiskDashboardStats {
  totalCases: number;
  overdueCases: number;
  totalAmount: number;
  overdueAmount: number;
  highRiskCases: number;
  inCollectionCases: number;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: 'collection_progress' | 'risk_assessment' | 'repayment_detail';
}

export interface ImportResult {
  success: boolean;
  total: number;
  imported: number;
  errors: string[];
  importedIds?: string[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const STATUS_LABELS: Record<CaseStatus, string> = {
  pending_confirmation: '待确权',
  confirmed: '已确权',
  confirmation_failed: '确权失败',
  normal_repayment: '正常回款',
  overdue: '逾期',
  in_collection: '催收中',
  in_negotiation: '协商中',
  legal_action: '法律诉讼',
  in_repayment: '回款中',
  settled: '已结清',
  confirmation_withdrawn: '已撤确认',
  re_overdue: '重新逾期',
};

export const STATUS_COLORS: Record<CaseStatus, string> = {
  pending_confirmation: 'bg-gray-100 text-gray-700',
  confirmed: 'bg-green-100 text-green-700',
  confirmation_failed: 'bg-red-100 text-red-700',
  normal_repayment: 'bg-blue-100 text-blue-700',
  overdue: 'bg-orange-100 text-orange-700',
  in_collection: 'bg-amber-100 text-amber-700',
  in_negotiation: 'bg-purple-100 text-purple-700',
  legal_action: 'bg-red-100 text-red-700',
  in_repayment: 'bg-cyan-100 text-cyan-700',
  settled: 'bg-emerald-100 text-emerald-700',
  confirmation_withdrawn: 'bg-rose-100 text-rose-700',
  re_overdue: 'bg-red-100 text-red-700',
};

export const RISK_COLORS: Record<RiskLevel, string> = {
  low: 'bg-green-500',
  medium: 'bg-amber-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
};

export const DATA_TYPE_LABELS: Record<BusinessDataType, string> = {
  invoice: '发票',
  confirmation: '买方确认',
  contract: '保理合同',
  repayment_plan: '回款计划',
  collection_note: '催收记录',
  risk_report: '风险报告',
};
