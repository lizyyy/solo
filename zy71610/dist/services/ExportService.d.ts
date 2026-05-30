import { SettlementApplication, SettlementStatement, ExportOptions } from '../types/models';
export declare class ExportService {
    private flattenApplication;
    private flattenStatement;
    exportApplicationsToCsv(applications: SettlementApplication[], options: ExportOptions): string;
    exportApplicationsToExcel(applications: SettlementApplication[], options: ExportOptions): Buffer;
    exportStatementsToCsv(statements: SettlementStatement[], options: ExportOptions): string;
    exportStatementsToExcel(statements: SettlementStatement[], options: ExportOptions): Buffer;
    exportDetailedApplication(application: SettlementApplication, statement?: SettlementStatement): string;
}
export declare const exportService: ExportService;
