import { DataStore } from '../store/store';
import { CheckResult, ReportSummary, Certificate, Environment } from '../types';
export declare class Reporter {
    private store;
    private rules;
    private readonly IMMEDIATE_DAYS;
    private readonly THIS_WEEK_DAYS;
    constructor(store: DataStore);
    generateCheckResult(cert: Certificate): CheckResult;
    checkAllCertificates(): CheckResult[];
    checkCertificateById(certId: string): CheckResult | null;
    checkByEnvironment(env: Environment): CheckResult[];
    generateReport(): ReportSummary;
    formatCheckResult(result: CheckResult, verbose?: boolean): string;
    formatReport(report: ReportSummary): string;
    private getStatusEmoji;
}
