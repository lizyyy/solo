import { PackingListComparisonService, PackingListComparisonResult } from './packing-list-comparison.service';
export declare class PackingListComparisonController {
    private readonly comparisonService;
    constructor(comparisonService: PackingListComparisonService);
    compareBatch(batchId: string): Promise<PackingListComparisonResult>;
}
