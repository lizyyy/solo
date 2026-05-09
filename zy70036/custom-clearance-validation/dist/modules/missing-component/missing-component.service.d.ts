import { InvoiceService } from '../version-management/invoice.service';
import { PackingListService } from '../version-management/packing-list.service';
import { HsCodeVersionService } from '../version-management/hs-code-version.service';
import { MissingComponentType, TaskPriority } from '../../entities/compliance-task.entity';
export interface MissingItem {
    componentType: MissingComponentType;
    lineNumber?: number;
    hsCode?: string;
    productName?: string;
    issue: string;
    priority: TaskPriority;
}
export interface MissingComponentResult {
    batchId: string;
    isBlocked: boolean;
    hasCriticalMissing: boolean;
    totalMissingCount: number;
    criticalMissingCount: number;
    documentLevelMissing: {
        missingInvoice: boolean;
        missingPackingList: boolean;
        missingHsCodes: boolean;
    };
    itemLevelMissing: MissingItem[];
    blockingIssues: string[];
    warnings: string[];
}
export declare class MissingComponentService {
    private readonly invoiceService;
    private readonly packingListService;
    private readonly hsCodeService;
    constructor(invoiceService: InvoiceService, packingListService: PackingListService, hsCodeService: HsCodeVersionService);
    private getPriorityOrder;
    private maxPriority;
    detectMissingComponents(batchId: string): Promise<MissingComponentResult>;
}
