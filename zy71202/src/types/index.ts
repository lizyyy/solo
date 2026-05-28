export interface ConvertibleBond {
  bondCode: string;
  bondName: string;
  stockCode: string;
  stockName: string;
  conversionPrice: number;
  redemptionPrice: number;
  currentPrice: number;
  stockPrice: number;
  conversionPremiumRate: number;
  industry: string;
  rating: string;
  maturityDate: string;
}

export interface StockQuote {
  stockCode: string;
  tradeDate: string;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  closePrice: number;
  volume: number;
  turnover: number;
  meetRedemptionCondition: boolean;
}

export type AnnouncementType = 'PRE_ANNOUNCE' | 'FORMAL_ANNOUNCE' | 'WITHDRAW_ANNOUNCE' | 'UPDATE_ANNOUNCE';

export interface RedemptionAnnouncement {
  id: string;
  bondCode: string;
  announcementDate: string;
  announcementType: AnnouncementType;
  title: string;
  content: string;
  redemptionDate: string;
  redemptionCode: string;
  version: number;
  isWithdrawn: boolean;
  previousVersionId: string | null;
  source: string;
  sourceUrl: string;
  fetchedAt: string;
}

export type CustomerType = 'INSTITUTION' | 'RETAIL';
export type CustomerTier = 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE';
export type RiskLevel = 'R1' | 'R2' | 'R3' | 'R4' | 'R5';

export interface CustomerPosition {
  id: string;
  customerId: string;
  customerName: string;
  customerType: CustomerType;
  tier: CustomerTier;
  riskLevel: RiskLevel;
  bondCode: string;
  bondName: string;
  position: number;
  positionAmount: number;
  costPrice: number;
  profitLoss: number;
  accountManager: string;
  source: string;
  fetchedAt: string;
}

export type WindowType = '30_15' | '20_10';

export interface TriggerWindowResult {
  bondCode: string;
  windowStartDate: string;
  windowEndDate: string;
  windowType: WindowType;
  totalDays: number;
  meetDays: number;
  consecutiveDays: number;
  hasGap: boolean;
  gapDates: string[];
  isTriggered: boolean;
  triggeredAt: string | null;
  dailyQuotes: StockQuote[];
}

export type ReminderType = 'SMS' | 'EMAIL' | 'PHONE' | 'SYSTEM';
export type ReminderStatus = 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED';

export interface ReminderLog {
  id: string;
  bondCode: string;
  customerId: string;
  customerName: string;
  reminderType: ReminderType;
  reminderContent: string;
  operatorId: string;
  operatorName: string;
  remindedAt: string;
  status: ReminderStatus;
  idempotencyKey: string;
  sourceTaskId: string;
}

export type TaskType = 'REMIND_CUSTOMER' | 'CONFIRM_DATA' | 'SUPPLEMENT_DATA';
export type TaskStatus = 'PENDING_CONFIRM' | 'PROCESSING' | 'PROCESSED' | 'RETURNED';
export type TaskPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface DisposalTask {
  id: string;
  bondCode: string;
  bondName: string;
  taskType: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  customerCount: number;
  totalPosition: number;
  assignedTo: string;
  createdAt: string;
  confirmedAt: string | null;
  processedAt: string | null;
  returnedAt: string | null;
  returnReason: string | null;
  supplementRequirements: string | null;
  remarks: string | null;
  dataSourceSnapshot: {
    marketData: string;
    announcement: string;
    position: string;
  };
}

export type DataType = 'BOND_INFO' | 'MARKET_DATA' | 'ANNOUNCEMENT' | 'POSITION' | 'REMINDER';

export interface DataSourceTrace {
  id: string;
  dataType: DataType;
  sourceSystem: string;
  sourceUrl: string;
  fetchedAt: string;
  dataHash: string;
  rawDataSnapshot: string;
  createdBy: string;
}

export interface SendReminderParams {
  bondCode: string;
  customerId: string;
  customerName: string;
  reminderType: ReminderType;
  reminderContent: string;
  operatorId: string;
  operatorName: string;
  sourceTaskId: string;
}

export type StatusTextMap = Record<string, string>;
