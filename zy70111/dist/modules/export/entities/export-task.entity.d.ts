import { ExportType, ExportStatus } from '../../../common/types';
export declare class ExportTask {
    id: string;
    taskNumber: string;
    exportType: ExportType;
    exportName: string;
    status: ExportStatus;
    filters: Record<string, any>;
    contentDescription: string;
    recordCount: number;
    filePath: string;
    fileName: string;
    fileSize: number;
    errorMessage: string;
    createdBy: string;
    createdByName: string;
    completedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
