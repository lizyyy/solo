export interface Customer {
  id: string;
  accountNo: string;
  customerName: string;
  riskLevel: 'low' | 'medium' | 'high';
  phone?: string;
}

export type SpecialFlag = 'suspended' | 'supplement_pending' | 'extension_old' | 'extension_pending';

export type PledgeStatus = 'normal' | 'warning' | 'close' | 'extended' | 'disposed';

export interface Pledge {
  id: string;
  customerId: string;
  stockCode: string;
  stockName: string;
  pledgeShares: number;
  principal: number;
  warningLine: number;
  closeLine: number;
  startDate: string;
  endDate: string;
  status: PledgeStatus;
  specialFlags: SpecialFlag[];
  createdAt: string;
  updatedAt: string;
}

export type TradingStatus = 'normal' | 'suspended' | 'halted';

export interface MarketData {
  id: string;
  stockCode: string;
  latestPrice: number;
  previousClose: number;
  tradingStatus: TradingStatus;
  valuationDiscount: number;
  updateTime: string;
}

export type NotificationMethod = 'sms' | 'email' | 'phone';

export interface MarginCall {
  id: string;
  pledgeId: string;
  sendTime: string;
  content: string;
  receiver: string;
  method: NotificationMethod;
  isDuplicate: boolean;
}

export type SupplementStatus = 'pending' | 'received' | 'cancelled';

export interface SupplementRecord {
  id: string;
  pledgeId: string;
  amount: number;
  expectedDate: string;
  actualDate?: string;
  status: SupplementStatus;
  afterPledgeRatio: number;
}

export type ExtensionStatus = 'pending' | 'approved' | 'rejected';

export interface ExtensionRecord {
  id: string;
  pledgeId: string;
  applyDate: string;
  approveDate?: string;
  newEndDate: string;
  newWarningLine: number;
  status: ExtensionStatus;
}

export type DisposalStatus = 'draft' | 'submitted' | 'completed';

export interface DisposalReport {
  id: string;
  pledgeId: string;
  reportDate: string;
  reportContent: string;
  operator: string;
  status: DisposalStatus;
}

export type OperationType = 'status_update' | 'supplement' | 'extension' | 'disposal' | 'import';

export interface HistoryRecord {
  id: string;
  pledgeId: string;
  operationType: OperationType;
  fieldName: string;
  beforeValue: string;
  afterValue: string;
  operator: string;
  operateTime: string;
}

export interface PledgeCalculation {
  marketValue: number;
  effectivePrice: number;
  pledgeRatio: number;
  isWarning: boolean;
  isClose: boolean;
  warningBuffer: number;
  effectiveWarningLine: number;
  calculationSteps: CalculationStep[];
}

export interface CalculationStep {
  label: string;
  value: string;
  formula?: string;
}

export interface Statistics {
  totalWarning: number;
  pendingSupplement: number;
  pendingExtension: number;
  pendingDisposal: number;
  specialCases: number;
  lastUpdateTime: string;
}

export interface ImportResult {
  success: boolean;
  total: number;
  imported: number;
  errors: ImportError[];
  warnings: ImportWarning[];
}

export interface ImportError {
  row: number;
  field: string;
  message: string;
}

export interface ImportWarning {
  row: number;
  type: SpecialFlag | string;
  message: string;
}

export type ImportDataType = 'customer' | 'pledge' | 'market' | 'warningLine' | 'supplement' | 'disposal';

export interface Filters {
  searchText: string;
  riskLevel: string;
  status: string;
  specialFlag: string;
  dateRange: [string, string];
}

export interface TimelineEvent {
  id: string;
  type: 'supplement' | 'marginCall' | 'extension' | 'disposal' | 'status';
  date: string;
  title: string;
  description: string;
  status: string;
  color: string;
}
