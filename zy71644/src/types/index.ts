import { Decimal } from 'decimal.js';

export type DayCountConvention = 'ACT/ACT' | 'ACT/365' | '30/360';
export type CouponFrequency = 1 | 2 | 4 | 12;
export type InterpolationMethod = 'LINEAR' | 'CUBIC_SPLINE';
export type PriceType = 'DIRTY' | 'CLEAN';
export type ReportStatus = 'PROCESSED' | 'PENDING_CONFIRM' | 'RETURNED';
export type ExceptionType = 'MISSING_PERIOD' | 'DUPLICATE_DATE' | 'IRREGULAR_AMOUNT' | 'INTERPOLATION_ERROR' | 'CONVEXITY_SIGN_ERROR';

export interface Bond {
  id: string;
  name: string;
  code: string;
  faceValue: Decimal;
  couponRate: Decimal;
  couponFrequency: CouponFrequency;
  issueDate: string;
  maturityDate: string;
  firstCouponDate: string;
  dayCountConvention: DayCountConvention;
  version: number;
  createdAt: string;
  updatedAt: string;
  remarks: string;
}

export interface CashFlow {
  id: string;
  bondId: string;
  period: number;
  paymentDate: string;
  couponPayment: Decimal;
  principalPayment: Decimal;
  totalPayment: Decimal;
  accruedDays: number;
  discountFactor?: Decimal;
  presentValue?: Decimal;
  weight?: Decimal;
  weightedTime?: Decimal;
  isException: boolean;
  exceptionType?: ExceptionType;
  exceptionMessage?: string;
  sourceRef: string;
}

export interface CurvePoint {
  term: Decimal;
  rate: Decimal;
  source?: string;
}

export interface YieldCurve {
  id: string;
  name: string;
  valueDate: string;
  points: CurvePoint[];
  interpolationMethod: InterpolationMethod;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CalculationParams {
  valuationDate: string;
  yieldCurveId: string;
  spread: Decimal;
  priceType: PriceType;
  yieldShiftBpSmall: number;
  yieldShiftBpLarge: number;
}

export interface CalculationStep {
  stepId: string;
  description: string;
  formula: string;
  inputs: Record<string, string>;
  result: string;
  sourceRef?: string;
}

export interface DurationResult {
  macaulayDuration: Decimal;
  modifiedDuration: Decimal;
  effectiveDuration: Decimal;
  dv01: Decimal;
  calculationSteps: CalculationStep[];
}

export interface ConvexityResult {
  convexity: Decimal;
  convexityAdjustment: Decimal;
  dollarConvexity: Decimal;
  signCheck: 'NORMAL' | 'ABNORMAL';
  signCheckMessage?: string;
  calculationSteps: CalculationStep[];
}

export interface SensitivityAnalysis {
  basePrice: Decimal;
  baseYield: Decimal;
  smallUpPrice: Decimal;
  smallDownPrice: Decimal;
  largeUpPrice: Decimal;
  largeDownPrice: Decimal;
  smallDurationEffect: Decimal;
  smallConvexityEffect: Decimal;
  largeDurationEffect: Decimal;
  largeConvexityEffect: Decimal;
  priceDiffExplanation: string;
}

export interface HandoverRecord {
  id: string;
  fromUser: string;
  toUser: string;
  timestamp: string;
  message: string;
}

export interface Report {
  id: string;
  bondId: string;
  bondVersion: number;
  curveId: string;
  curveVersion: number;
  params: CalculationParams;
  duration: DurationResult;
  convexity: ConvexityResult;
  sensitivity: SensitivityAnalysis;
  cashFlows: CashFlow[];
  status: ReportStatus;
  statusRemark?: string;
  handoverRecord: HandoverRecord[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

export interface AppException {
  id: string;
  type: ExceptionType;
  message: string;
  sourceRef: string;
  timestamp: string;
  severity: 'ERROR' | 'WARNING';
}
