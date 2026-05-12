import { Appeal, AppealHistory, AppealCorrection, PlatformPenalty, Order } from '../types';
interface FullAppealDetail {
    appeal: Appeal;
    order?: Order;
    penalty?: PlatformPenalty;
    history: AppealHistory[];
    corrections: AppealCorrection[];
}
export declare function getAppealDetail(appealId: string): Promise<FullAppealDetail>;
export declare function listAppeals(options?: {
    status?: string;
    riderId?: string;
    orderNo?: string;
    appealType?: string;
}): Promise<Appeal[]>;
interface SummaryStats {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    corrected: number;
    totalPenaltyAmount: number;
    totalRevertedAmount: number;
    byType: Record<string, number>;
}
export declare function getSummaryStats(): Promise<SummaryStats>;
export declare function generateReport(appealId: string, format?: 'text' | 'json'): Promise<string>;
export declare function exportReportToFile(appealId: string, format?: 'text' | 'json'): Promise<string>;
export {};
//# sourceMappingURL=reportService.d.ts.map