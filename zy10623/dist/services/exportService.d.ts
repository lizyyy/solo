import { ApiResponse } from '../utils/response';
declare class ExportService {
    exportToCsv(filters?: any): Promise<ApiResponse<{
        filePath: string;
        recordCount: number;
    }>>;
    private mapToExportRecord;
    getExportFieldConfig(): ApiResponse<{
        field: string;
        label: string;
    }[]>;
}
export declare const exportService: ExportService;
export {};
