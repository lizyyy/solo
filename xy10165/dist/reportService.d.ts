import { getAllPurchaseRequests, getAllContractPayments, getExceptions } from './models';
import { CheckResult } from './budgetService';
export interface ReportData {
    summary: {
        totalBudgets: number;
        overBudgetCount: number;
        overThresholdCount: number;
        totalPurchaseRequests: number;
        totalPayments: number;
        pendingExceptions: number;
    };
    budgets: CheckResult[];
    purchaseRequests: ReturnType<typeof getAllPurchaseRequests>;
    payments: ReturnType<typeof getAllContractPayments>;
    exceptions: ReturnType<typeof getExceptions>;
}
export declare function generateReportData(): ReportData;
export declare function generateExcelReport(outputPath: string): void;
//# sourceMappingURL=reportService.d.ts.map