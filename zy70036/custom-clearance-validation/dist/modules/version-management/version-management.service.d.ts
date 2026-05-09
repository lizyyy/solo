import { InvoiceService } from './invoice.service';
import { PackingListService } from './packing-list.service';
import { HsCodeVersionService } from './hs-code-version.service';
export interface VersionConsistencyInfo {
    isConsistent: boolean;
    hsCodeVersions: number;
    invoiceVersions: number;
    packingListVersions: number;
    details: {
        source: string;
        latestVersion: number;
    }[];
}
export declare class VersionManagementService {
    private readonly invoiceService;
    private readonly packingListService;
    private readonly hsCodeService;
    constructor(invoiceService: InvoiceService, packingListService: PackingListService, hsCodeService: HsCodeVersionService);
    getVersionConsistency(batchId: string): Promise<VersionConsistencyInfo>;
    checkVersions(batchId: string): Promise<{
        hasInvoice: boolean;
        hasPackingList: boolean;
        hasHsCodes: boolean;
        latestInvoiceVersion: number;
        latestPackingListVersion: number;
        latestHsCodeVersion: number;
    }>;
}
