import { TrackingManifest, EventLog, RegressionReport, IssueSeverity, ValidationConfig } from '../types';
export declare class RegressionValidator {
    private config;
    constructor(config?: Partial<ValidationConfig>);
    validate(manifest: TrackingManifest, eventLog: EventLog, baselineManifest?: TrackingManifest): RegressionReport;
    private summarizeIssues;
    private countStatuses;
    private generateReportId;
    filterBySeverity(report: RegressionReport, minSeverity: IssueSeverity): RegressionReport;
    filterByPagePath(report: RegressionReport, pagePath: string, manifest: TrackingManifest): RegressionReport;
    filterByCategory(report: RegressionReport, category: string, manifest: TrackingManifest): RegressionReport;
}
