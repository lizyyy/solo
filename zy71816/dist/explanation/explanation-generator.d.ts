import type { JudgmentResult, CrossPeriodFeeAlert, ReceiptHistoryEntry, ReconciliationStatement, RefundChangeRecord } from '../domain/types.js';
export declare class ExplanationGenerator {
    static formatJudgment(result: JudgmentResult): string;
    static formatCrossPeriodAlert(alert: CrossPeriodFeeAlert): string;
    static formatHistoryEntries(entries: ReceiptHistoryEntry[]): string;
    static formatReconciliation(stmt: ReconciliationStatement): string;
    static formatRefundChanges(changes: RefundChangeRecord[]): string;
}
