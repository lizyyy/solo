export type Currency = 'USD' | 'EUR' | 'JPY' | 'GBP';

export type OrderStatus = 
  | 'pending' 
  | 'confirmed' 
  | 'shipped' 
  | 'delivered' 
  | 'defaulted' 
  | 'cancelled';

export type TransactionType = 
  | 'sale' 
  | 'purchase' 
  | 'forex_exchange' 
  | 'inventory_cost' 
  | 'refund'
  | 'correction';

export type TransactionStatus = 
  | 'normal' 
  | 'supplement' 
  | 'reversed' 
  | 'duplicate' 
  | 'pending_review';

export type ExceptionType = 
  | 'forex_loss' 
  | 'inventory_overstock' 
  | 'customer_default'
  | 'missing_fields'
  | 'late_submission';

export type ExceptionStatus = 
  | 'pending' 
  | 'confirmed' 
  | 'waived' 
  | 'resolved';

export interface ExchangeRate {
  id: string;
  currency: Currency;
  rate: number;
  previousRate: number;
  trend: 'up' | 'down' | 'stable';
  round: number;
  cardType: 'normal' | 'shock' | 'recovery';
  description: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  unitCost: number;
  currency: Currency;
}

export interface InventoryItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  totalValue: number;
  currency: Currency;
  purchaseRound: number;
  overstockThreshold: number;
  isOverstock: boolean;
}

export interface Order {
  id: string;
  orderNo: string;
  customerName: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  currency: Currency;
  status: OrderStatus;
  createRound: number;
  expectedDeliveryRound: number;
  actualDeliveryRound?: number;
  defaultRisk: number;
  hasMissingFields: boolean;
  missingFields?: string[];
  isLateSubmission: boolean;
  lateReason?: string;
  remarks?: string;
  lastModified?: Date;
  modifiedBy?: string;
  modificationReason?: string;
}

export interface Transaction {
  id: string;
  transactionNo: string;
  type: TransactionType;
  amount: number;
  currency: Currency;
  cnyEquivalent: number;
  exchangeRateUsed: number;
  description: string;
  relatedOrderId?: string;
  relatedInventoryId?: string;
  status: TransactionStatus;
  round: number;
  createTime: Date;
  isSupplement?: boolean;
  supplementReason?: string;
  supplementRound?: number;
  isReversed?: boolean;
  reversedTransactionId?: string;
  reversalReason?: string;
  isDuplicate?: boolean;
  duplicateOfId?: string;
  correctionHistory?: CorrectionRecord[];
}

export interface CorrectionRecord {
  id: string;
  transactionId: string;
  fieldName: string;
  oldValue: any;
  newValue: any;
  reason: string;
  operator: string;
  timestamp: Date;
  round: number;
}

export interface ExceptionItem {
  id: string;
  type: ExceptionType;
  status: ExceptionStatus;
  title: string;
  description: string;
  amount?: number;
  currency?: Currency;
  relatedTransactionId?: string;
  relatedOrderId?: string;
  relatedInventoryId?: string;
  round: number;
  discoveredRound: number;
  resolvedRound?: number;
  resolution?: string;
  operator?: string;
}

export interface RoundResult {
  round: number;
  startCash: number;
  endCash: number;
  cashChange: number;
  revenue: number;
  costs: number;
  forexGainLoss: number;
  inventoryValue: number;
  ordersCompleted: number;
  ordersDefaulted: number;
  exceptionsGenerated: string[];
  decisions: string[];
  resultAnalysis: string;
}

export interface GameState {
  currentRound: number;
  totalRounds: number;
  cash: number;
  initialCash: number;
  targetCash: number;
  exchangeRates: ExchangeRate[];
  currentRate: ExchangeRate;
  inventory: InventoryItem[];
  orders: Order[];
  transactions: Transaction[];
  exceptions: ExceptionItem[];
  correctionRecords: CorrectionRecord[];
  roundHistory: RoundResult[];
  isGameOver: boolean;
  gameResult?: 'win' | 'lose';
  finalAnalysis?: string;
  selectedTab: 'dashboard' | 'orders' | 'inventory' | 'ledger' | 'exceptions' | 'review';
}

export interface GameAction {
  type: string;
  payload?: any;
}

export interface DecisionOption {
  id: string;
  title: string;
  description: string;
  risk: 'low' | 'medium' | 'high';
  potentialGain: number;
  potentialLoss: number;
}
