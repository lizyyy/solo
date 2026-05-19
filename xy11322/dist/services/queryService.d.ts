import { WorkRecord, QueryFilter, ReportData } from '../types';
export declare class QueryService {
    queryRecords(filter: QueryFilter): WorkRecord[];
    getRecordById(id: string): WorkRecord | undefined;
    getRecordByRecordNo(recordNo: string): WorkRecord | undefined;
    generateReport(filter: QueryFilter, operator: string): ReportData;
    exportToCSV(report: ReportData, filePath: string): void;
    exportToJSON(report: ReportData, filePath: string): void;
    private getStatusText;
    getStatistics(filter?: QueryFilter): {
        totalRecords: number;
        totalAmount: number;
        byStatus: Record<string, number>;
        byBillingType: Record<string, number>;
        byOperator: Record<string, number>;
    };
    private groupByStatus;
    private groupByBillingType;
    private groupByOperator;
}
export declare const queryService: QueryService;
