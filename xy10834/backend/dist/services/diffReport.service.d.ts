export interface GenerateDiffReportDTO {
    configKey: string;
    baseVersion: number;
    targetVersion: number;
    generatedBy?: string;
}
export declare class DiffReportService {
    generateReport(dto: GenerateDiffReportDTO): Promise<{
        configItem: {
            id: string;
            key: string;
            value: string;
            description: string | null;
            status: string;
            version: number;
            createdAt: Date;
            updatedAt: Date;
            createdBy: string | null;
        };
    } & {
        id: string;
        generatedAt: Date;
        configId: string;
        baseVersion: number;
        targetVersion: number;
        diffContent: string;
        affectedInstances: number;
        generatedBy: string | null;
        exportedAt: Date | null;
    }>;
    private calculateDiff;
    findAll(params: {
        page?: number;
        pageSize?: number;
        configId?: string;
    }): Promise<{
        reports: ({
            configItem: {
                key: string;
            };
        } & {
            id: string;
            generatedAt: Date;
            configId: string;
            baseVersion: number;
            targetVersion: number;
            diffContent: string;
            affectedInstances: number;
            generatedBy: string | null;
            exportedAt: Date | null;
        })[];
        pagination: {
            page: number;
            pageSize: number;
            total: number;
            totalPages: number;
        };
    }>;
    findById(id: string): Promise<{
        configItem: {
            id: string;
            key: string;
            value: string;
            description: string | null;
            status: string;
            version: number;
            createdAt: Date;
            updatedAt: Date;
            createdBy: string | null;
        };
    } & {
        id: string;
        generatedAt: Date;
        configId: string;
        baseVersion: number;
        targetVersion: number;
        diffContent: string;
        affectedInstances: number;
        generatedBy: string | null;
        exportedAt: Date | null;
    }>;
    getConfigVersions(configKey: string): Promise<number[]>;
    exportToCSV(reportId: string): Promise<string>;
    exportEffectiveStatesCSV(configId: string): Promise<string>;
}
declare const _default: DiffReportService;
export default _default;
