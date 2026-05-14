import { InitStep, TenantInitRecord, InitDetailItem } from '../types';
export declare class TenantInitService {
    private createRecord;
    private updateRecordStatus;
    private updateRecordCounts;
    private updateMaterialSummary;
    private createDetailItem;
    private validatePackagePath;
    private extractFiles;
    private parseMetadata;
    private generateMockDevices;
    private createTenant;
    private importDevices;
    private configurePermissions;
    initializeTenant(tenantId: string, tenantName: string, packagePath: string): Promise<{
        recordId: string;
        success: boolean;
        currentStep?: InitStep;
        error?: string;
    }>;
    private getCurrentStep;
    getInitRecord(recordId: string): Promise<TenantInitRecord | null>;
    getInitRecords(filters?: {
        status?: string;
        tenantId?: string;
    }): Promise<TenantInitRecord[]>;
    getDetailItems(recordId: string, filters?: {
        status?: string;
        step?: string;
    }): Promise<InitDetailItem[]>;
    private mapToTenantInitRecord;
    private mapToInitDetailItem;
}
export declare const tenantInitService: TenantInitService;
