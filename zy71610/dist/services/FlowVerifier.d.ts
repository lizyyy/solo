import { RepaymentFlow, InstallmentContract, ReasonDetail, AnomalyMarker, Currency } from '../types/models';
export declare class FlowVerifier {
    private createReason;
    private createAnomaly;
    verifyFlows(contract: InstallmentContract, flows: RepaymentFlow[]): {
        isValid: boolean;
        reasons: ReasonDetail[];
        anomalies: AnomalyMarker[];
        totalPaidPrincipal: Currency;
        totalPaidInterest: Currency;
        totalPaidServiceFee: Currency;
    };
}
