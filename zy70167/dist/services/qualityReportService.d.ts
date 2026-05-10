import { QualityReport } from '../types';
export interface GenerateReportRequest {
    ruleVersionId: string;
    reportDate?: string;
    generatedBy: string;
}
export declare function generateQualityReport(request: GenerateReportRequest): Promise<QualityReport>;
export declare function getReportById(id: string): Promise<QualityReport | null>;
export declare function listReportsByRuleVersion(ruleVersionId: string, options?: {
    page?: number;
    pageSize?: number;
}): Promise<{
    reports: QualityReport[];
    total: number;
}>;
export declare function getRuleVersionSummary(ruleVersionId: string): Promise<{
    ruleVersion: {
        id: string;
        ruleId: string;
        ruleName: string;
        version: number;
        status: string;
    };
    batchStatistics: {
        total: number;
        success: number;
        failed: number;
        pending: number;
        running: number;
        successRate: string;
        averageScore: string;
    };
    subscriptionCount: number;
    activeSubscriptionCount: number;
    waiveCount: number;
    totalWaivedRows: number;
    reportCount: number;
}>;
//# sourceMappingURL=qualityReportService.d.ts.map