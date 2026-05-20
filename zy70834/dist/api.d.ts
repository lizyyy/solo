import { ReconciliationResult } from './types';
export declare class ReconciliationAPI {
    private importService;
    private engine;
    private reviewService;
    private reportService;
    constructor(reconciliationDate?: string);
    importFromFiles(classListPath: string, healthCheckPath: string, medicationPath: string): Promise<{
        students: number;
        healthChecks: number;
        medications: number;
    }>;
    performReconciliation(): ReconciliationResult[];
    getResults(): ReconciliationResult[];
    getResultsByStatus(status: any): ReconciliationResult[];
    getResultById(id: string): ReconciliationResult | undefined;
    approveResult(resultId: string, reviewer: string, notes?: string): ReconciliationResult | null;
    rejectResult(resultId: string, reviewer: string, notes?: string): ReconciliationResult | null;
    requestMoreInfo(resultId: string, reviewer: string, notes?: string): ReconciliationResult | null;
    modifyResult(resultId: string, reviewer: string, modifications: {
        field: string;
        oldValue: any;
        newValue: any;
        reason: string;
    }[]): ReconciliationResult | null;
    batchApprove(resultIds: string[], reviewer: string): ReconciliationResult[];
    getSummary(): import("./types").SummaryStatistics;
    exportReportJSON(outputPath: string, generatedBy: string): void;
    exportReportCSV(outputPath: string): void;
    exportReportText(outputPath: string, generatedBy: string): string;
    getTextReport(generatedBy: string): string;
    getAuditTrail(resultId: string): {
        status: string;
        reviewedBy?: string;
        reviewedAt?: string;
        notes?: string;
    } | null;
    getModificationHistory(resultId: string): string | null;
}
