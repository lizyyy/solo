import { SelfCheckReport } from '../types';
export declare class SelfCheckService {
    runFullCheck(): SelfCheckReport;
    private checkDuplicateImports;
    private checkLeaveCountedAsConsumed;
    private checkSupplementRecalculate;
    private checkExportConsistency;
    autoFixIssues(report: SelfCheckReport): {
        fixed: string[];
        messages: string[];
    };
    formatReport(report: SelfCheckReport): string;
    private getCheckTypeName;
}
export declare const selfCheckService: SelfCheckService;
