export type Currency = number;
export interface BaseEntity {
    id: string;
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    updatedBy: string;
}
export interface VersionedValue<T> {
    original: T;
    corrected?: T;
    final: T;
}
export interface ReasonDetail {
    code: string;
    message: string;
    source: string;
    timestamp: string;
    operator?: string;
}
export type SettlementStatus = 'DRAFT' | 'PENDING_REVIEW' | 'REVIEWED' | 'APPROVED' | 'EXECUTED' | 'REJECTED' | 'CANCELLED';
export type AnomalyType = 'SERVICE_FEE_MISSING_REFUND' | 'OVERDUE_NOT_SETTLED' | 'DUPLICATE_APPLICATION' | 'PRINCIPAL_MISMATCH' | 'FLOW_NOT_MATCHED';
export interface AnomalyMarker {
    type: AnomalyType;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    message: string;
    resolved: boolean;
    resolvedAt?: string;
    resolvedBy?: string;
}
export interface InstallmentContract extends BaseEntity {
    contractNo: string;
    customerName: string;
    customerId: string;
    principal: VersionedValue<Currency>;
    totalAmount: Currency;
    termCount: number;
    termUnit: 'MONTH' | 'DAY';
    annualInterestRate: number;
    serviceFeeRate: number;
    startDate: string;
    endDate: string;
    status: 'NORMAL' | 'OVERDUE' | 'SETTLED' | 'EARLY_SETTLED';
}
export interface RepaymentFlow extends BaseEntity {
    flowNo: string;
    contractNo: string;
    termNo: number;
    dueDate: string;
    paymentDate?: string;
    payablePrincipal: VersionedValue<Currency>;
    payableInterest: VersionedValue<Currency>;
    payableServiceFee: VersionedValue<Currency>;
    paidPrincipal: Currency;
    paidInterest: Currency;
    paidServiceFee: Currency;
    status: 'PENDING' | 'PAID' | 'OVERDUE' | 'PARTIAL';
    isEarlySettled: boolean;
}
export interface OverdueRecord extends BaseEntity {
    recordNo: string;
    contractNo: string;
    termNo: number;
    overdueDays: VersionedValue<number>;
    overdueAmount: VersionedValue<Currency>;
    penaltyRate: number;
    penaltyAmount: VersionedValue<Currency>;
    status: 'ACTIVE' | 'WAIVED' | 'SETTLED';
}
export interface FeeRule extends BaseEntity {
    ruleCode: string;
    ruleName: string;
    contractType: string;
    earlySettlementPenaltyRate: number;
    serviceFeeRefundRate: number;
    minServiceFeeRefund: Currency;
    isActive: boolean;
    effectiveDate: string;
}
export interface SettlementApplication extends BaseEntity {
    applicationNo: string;
    contractNo: string;
    applicant: string;
    applicationDate: string;
    expectedSettlementDate: string;
    remainingPrincipal: VersionedValue<Currency>;
    remainingServiceFee: VersionedValue<Currency>;
    refundableServiceFee: VersionedValue<Currency>;
    earlySettlementPenalty: VersionedValue<Currency>;
    totalPayableAmount: VersionedValue<Currency>;
    settlementReason: string;
    remark?: string;
    status: SettlementStatus;
    anomalies: AnomalyMarker[];
    reasons: {
        trialCalculation: ReasonDetail[];
        feeReversal: ReasonDetail[];
        flowVerification: ReasonDetail[];
        stateTransition: ReasonDetail[];
    };
    settlementDate?: string;
    settledBy?: string;
}
export interface SettlementStatement extends BaseEntity {
    statementNo: string;
    applicationNo: string;
    contractNo: string;
    originalSnapshot: {
        remainingPrincipal: Currency;
        remainingServiceFee: Currency;
        refundableServiceFee: Currency;
        earlySettlementPenalty: Currency;
        totalPayableAmount: Currency;
        overdueRecords: Array<{
            recordNo: string;
            overdueDays: number;
            overdueAmount: Currency;
        }>;
        repaymentFlows: Array<{
            flowNo: string;
            termNo: number;
            paidPrincipal: Currency;
            paidServiceFee: Currency;
        }>;
    };
    correctionSnapshot?: {
        remainingPrincipal?: Currency;
        remainingServiceFee?: Currency;
        refundableServiceFee?: Currency;
        earlySettlementPenalty?: Currency;
        totalPayableAmount?: Currency;
        remark?: string;
        correctedBy: string;
        correctedAt: string;
    };
    finalSnapshot: {
        remainingPrincipal: Currency;
        remainingServiceFee: Currency;
        refundableServiceFee: Currency;
        earlySettlementPenalty: Currency;
        totalPayableAmount: Currency;
        conclusion: string;
    };
    anomalies: AnomalyMarker[];
    isExported: boolean;
    exportedAt?: string;
    exportedBy?: string;
}
export interface SettlementHistory {
    id: string;
    applicationNo: string;
    fieldName: string;
    oldValue: unknown;
    newValue: unknown;
    changedBy: string;
    changedAt: string;
    changeReason: string;
}
export interface SettlementFilter {
    contractNo?: string;
    customerName?: string;
    status?: SettlementStatus[];
    applicationDateFrom?: string;
    applicationDateTo?: string;
    hasAnomalies?: boolean;
    anomalyTypes?: AnomalyType[];
}
export interface ExportOptions {
    includeOriginal: boolean;
    includeCorrection: boolean;
    includeAnomalies: boolean;
    includeReasons: boolean;
    format: 'CSV' | 'EXCEL';
}
