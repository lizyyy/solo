import { Order, Refund, RuleVersion, SettlementResult, SimulationResult, ExplainDetail } from './types';
import { DataLoader } from './data-loader';
export declare class SettlementEngine {
    private dataLoader;
    constructor(dataLoader: DataLoader);
    calculateSettlement(order: Order, rules: RuleVersion[], refunds: Refund[]): SettlementResult;
    private getRuleForDate;
    private calculateTotalRefundAmount;
    private calculatePartySettlement;
    simulateAll(rulesType: 'old' | 'new'): SettlementResult[];
    calculateDifferences(): SimulationResult;
    private calculateSummary;
    explainOrder(orderId: string): ExplainDetail | null;
}
//# sourceMappingURL=settlement-engine.d.ts.map