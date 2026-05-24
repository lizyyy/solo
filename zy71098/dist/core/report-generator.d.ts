import { BounceRecord, AnalysisReport } from '../types';
export declare class ReportGenerator {
    generateReport(records: BounceRecord[]): AnalysisReport;
    private aggregateByBatch;
    private analyzeBatch;
    private initCategoryBreakdown;
    private calculateOverallBreakdown;
    private getTopReasons;
    private calculateSummary;
    private generateRecommendations;
    private getProviderStats;
}
