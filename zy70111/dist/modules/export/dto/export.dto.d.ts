import { ExportType } from '../../../common/types';
export declare class CreateExportTaskDto {
    exportType: ExportType;
    exportName: string;
    startDate?: Date;
    endDate?: Date;
    filters?: Record<string, any>;
    remarks?: string;
}
export declare class ExportQueryDto {
    exportType?: string[];
    status?: string[];
    page?: number;
    pageSize?: number;
}
