import { VersionManagementService, VersionConsistencyInfo } from './version-management.service';
export declare class VersionManagementController {
    private readonly versionService;
    constructor(versionService: VersionManagementService);
    checkConsistency(batchId: string): Promise<VersionConsistencyInfo>;
    checkVersions(batchId: string): Promise<{
        hasInvoice: boolean;
        hasPackingList: boolean;
        hasHsCodes: boolean;
        latestInvoiceVersion: number;
        latestPackingListVersion: number;
        latestHsCodeVersion: number;
    }>;
}
