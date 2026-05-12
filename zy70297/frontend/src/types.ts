export type ProblemType = 'hose' | 'alarm' | 'valve';

export type InspectionStatus = 
  | 'pending'
  | 'completed'
  | 'has_problem';

export type RectificationStatus =
  | 'created'
  | 'scheduled_review'
  | 'review_failed'
  | 'gas_cut_off'
  | 'completed';

export interface Merchant {
  id: string;
  name: string;
  address: string;
  contactPerson: string;
  contactPhone: string;
  businessType: string;
  gasSupplier: string;
  accountNo: string;
  createdAt: string;
  updatedAt: string;
  currentStatus: 'normal' | 'warning' | 'gas_cut_off';
}

export interface InspectionProblem {
  id: string;
  inspectionId: string;
  problemType: ProblemType;
  description: string;
  severity: 'critical' | 'major' | 'minor';
  rectificationDays: number;
  createdAt: string;
}

export interface Inspection {
  id: string;
  merchantId: string;
  inspector: string;
  inspectionDate: string;
  status: InspectionStatus;
  problems: InspectionProblem[];
  remarks: string;
  createdAt: string;
}

export interface StatusChange {
  id: string;
  taskId: string;
  fromStatus: string;
  toStatus: string;
  operator: string;
  reason: string;
  timestamp: string;
}

export interface TaskSuggestion {
  currentBlock: string;
  suggestion: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
}

export interface RectificationTaskWithSuggestion {
  id: string;
  merchantId: string;
  merchantName: string;
  inspectionId: string;
  problemId: string;
  problemType: ProblemType;
  problemDescription: string;
  severity: 'critical' | 'major' | 'minor';
  status: RectificationStatus;
  deadline: string;
  reviewScheduledDate?: string;
  reviewDate?: string;
  reviewResult?: 'passed' | 'failed';
  gasCutOffDate?: string;
  completedDate?: string;
  handler?: string;
  createdAt: string;
  updatedAt: string;
  suggestion: TaskSuggestion;
}

export interface ReportStats {
  period: string;
  totalMerchants: number;
  normalMerchants: number;
  warningMerchants: number;
  gasCutOffMerchants: number;
  totalTasks: number;
  tasksByStatus: Record<string, number>;
  tasksByType: Record<string, number>;
  overdueTasks: number;
}

export interface ReportRiskItem {
  taskId: string;
  merchantName: string;
  problemType: ProblemType;
  problemDescription: string;
  status: RectificationStatus;
  severity: 'critical' | 'major' | 'minor';
  deadline: string;
  overdueDays: number;
  gasCutOff: boolean;
  suggestion: TaskSuggestion;
}

export interface ReportData {
  stats: ReportStats;
  riskList: ReportRiskItem[];
  rules: {
    rectificationDays: Record<ProblemType, number>;
    gasCutOffAfterFailedReviews: number;
  };
}
