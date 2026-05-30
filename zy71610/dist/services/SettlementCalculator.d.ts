import { InstallmentContract, RepaymentFlow, OverdueRecord, FeeRule, ReasonDetail, Currency, VersionedValue } from '../types/models';
export declare class SettlementCalculator {
    createReason(code: string, message: string, source: string, operator?: string): ReasonDetail;
    createVersionedValue<T>(original: T, corrected?: T): VersionedValue<T>;
    calculateRemainingPrincipal(contract: InstallmentContract, flows: RepaymentFlow[]): {
        amount: Currency;
        reasons: ReasonDetail[];
    };
    calculateRemainingServiceFee(contract: InstallmentContract, flows: RepaymentFlow[]): {
        amount: Currency;
        reasons: ReasonDetail[];
    };
    calculateRefundableServiceFee(contract: InstallmentContract, flows: RepaymentFlow[], feeRule: FeeRule, settlementDate: string): {
        amount: Currency;
        reasons: ReasonDetail[];
    };
    calculateEarlySettlementPenalty(remainingPrincipal: Currency, feeRule: FeeRule): {
        amount: Currency;
        reasons: ReasonDetail[];
    };
    calculateTotalPayable(remainingPrincipal: Currency, earlySettlementPenalty: Currency, overdueRecords: OverdueRecord[]): {
        amount: Currency;
        reasons: ReasonDetail[];
    };
    calculateSettlement(contract: InstallmentContract, flows: RepaymentFlow[], overdueRecords: OverdueRecord[], feeRule: FeeRule, expectedSettlementDate: string, operator: string): {
        remainingPrincipal: VersionedValue<Currency>;
        remainingServiceFee: VersionedValue<Currency>;
        refundableServiceFee: VersionedValue<Currency>;
        earlySettlementPenalty: VersionedValue<Currency>;
        totalPayableAmount: VersionedValue<Currency>;
        reasons: {
            trialCalculation: ReasonDetail[];
            feeReversal: ReasonDetail[];
            flowVerification: ReasonDetail[];
            stateTransition: ReasonDetail[];
        };
    };
}
