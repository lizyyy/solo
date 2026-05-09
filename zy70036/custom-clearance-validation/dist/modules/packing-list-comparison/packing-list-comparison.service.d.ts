import { InvoiceService } from '../version-management/invoice.service';
import { PackingListService } from '../version-management/packing-list.service';
export interface QuantityMismatch {
    hsCode: string;
    productName: string;
    invoiceQuantity: number;
    packingListQuantity: number;
    difference: number;
    percentage: number;
}
export interface ValueComparison {
    isConsistent: boolean;
    invoiceTotal: number;
    invoiceCurrency: string;
    invoiceItemCount: number;
    packingListTotalPackages: number;
    totalGrossWeight: number;
    totalNetWeight: number;
    weightUnit: string;
    totalVolume: number;
    volumeUnit: string;
}
export interface PackingListComparisonResult {
    batchId: string;
    isConsistent: boolean;
    hasInvoice: boolean;
    hasPackingList: boolean;
    quantityComparison: {
        totalQuantityInvoice: number;
        totalQuantityPackingList: number;
        quantityDifference: number;
        quantityMismatches: QuantityMismatch[];
        invoiceOnlyHsCodes: string[];
        packingListOnlyHsCodes: string[];
    };
    valueComparison: ValueComparison;
    hsCodeComparison: {
        commonHsCodes: string[];
        invoiceOnlyHsCodes: string[];
        packingListOnlyHsCodes: string[];
    };
    summary: {
        totalMismatches: number;
        criticalMismatches: number;
        warnings: string[];
    };
}
export declare class PackingListComparisonService {
    private readonly invoiceService;
    private readonly packingListService;
    constructor(invoiceService: InvoiceService, packingListService: PackingListService);
    compareBatch(batchId: string): Promise<PackingListComparisonResult>;
}
