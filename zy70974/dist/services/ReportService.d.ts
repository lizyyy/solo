import { ReconciliationRecord, ReconciliationBatch } from '../types';
export declare class ReportService {
    private translateActivityType;
    private translateReviewStatus;
    private translateFinalStatus;
    private translateCheckInStatus;
    private translateRegistrationStatus;
    private translateDiscrepancyType;
    generateDetailedReport(batch: ReconciliationBatch, records: ReconciliationRecord[]): string;
    generateSummaryCSV(batch: ReconciliationBatch, records: ReconciliationRecord[]): string;
    generateDiscrepancyReport(batch: ReconciliationBatch, records: ReconciliationRecord[]): string;
    generateAuditTrailCSV(records: ReconciliationRecord[]): string;
    generateJSONReport(batch: ReconciliationBatch, records: ReconciliationRecord[]): string;
}
