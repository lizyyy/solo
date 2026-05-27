export type Currency = 'USD' | 'EUR' | 'CNY';

export type DiscountStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'DISCOUNTED'
  | 'PARTIALLY_SETTLED'
  | 'FULLY_SETTLED'
  | 'COMPLETED';

export interface ExchangeRate {
  fromCurrency: Currency;
  toCurrency: Currency;
  rate: number;
  rateDate: string;
  source: string;
}

export interface InvoiceDiscount {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceAmount: number;
  invoiceCurrency: Currency;
  discountRate: number;
  discountDate: string;
  discountStatus: DiscountStatus;
  discountDays: number;
  exchangeRateToCNY: ExchangeRate | null;
  exchangeRatePaymentToCNY: ExchangeRate | null;
  createdAt: string;
  updatedAt: string;
  missingFields: string[];
  revisionHistory: RevisionEntry[];
  partialDiscountDetails: PartialDiscountDetail[];
  totalDiscountedAmount: number;
  remainingUndiscountedAmount: number;
}

export interface PartialDiscountDetail {
  id: string;
  discountAmount: number;
  discountDate: string;
  discountRate: number;
  interestAmount: number;
  interestCurrency: Currency;
}

export interface Payment {
  id: string;
  invoiceDiscountId: string;
  paymentAmount: number;
  paymentCurrency: Currency;
  paymentDate: string;
  bankReceiptId: string | null;
  matched: boolean;
  matchedAmount: number;
}

export interface BankReceipt {
  id: string;
  receiptNumber: string;
  receiptDate: string;
  amount: number;
  currency: Currency;
  importedAt: string;
  isDuplicate: boolean;
  duplicateOf: string | null;
  invoiceDiscountId: string | null;
}

export interface ProfitReport {
  id: string;
  invoiceDiscountId: string;
  reportDate: string;
  invoiceAmountCNY: number;
  totalPaymentReceivedCNY: number;
  totalDiscountInterestCNY: number;
  bankFeesCNY: number;
  exchangeGainLossCNY: number;
  netProfitCNY: number;
}

export interface RevisionEntry {
  id: string;
  revisionDate: string;
  fieldName: string;
  oldValue: unknown;
  newValue: unknown;
  reason: string;
  operator: string;
}

export interface DiscountCalculationResult {
  invoiceAmountCNY: number;
  discountInterestCNY: number;
  netProceedsCNY: number;
  dailyInterestCNY: number;
  totalInterest: number;
  interestCurrency: Currency;
  effectiveAnnualRate: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  warnings: string[];
  missingFields: string[];
}
