export type ExportFormat = 'json' | 'csv';
export declare class ExportService {
    private store;
    exportReport(requestId: string, reportId: string, format?: ExportFormat): Promise<string | undefined>;
    exportFullRequest(requestId: string, format?: ExportFormat): Promise<string | undefined>;
    private exportToJson;
    private exportToCsv;
    private exportFullRequestToCsv;
    private serializeDate;
    getExportFilename(requestId: string, format: ExportFormat, type: 'report' | 'full'): string;
}
export declare const exportService: ExportService;
