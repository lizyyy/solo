import { StoredResult, LakehousePartition, BatchItem, SchemaDiff } from './types';
export declare class ResultStore {
    private dataDir;
    private resultsFile;
    private partitionsFile;
    private failuresFile;
    constructor(dataDir?: string);
    private ensureDataDir;
    findPreviousResult(orderId: string): StoredResult | null;
    detectConflict(orderId: string, schemaDiffs: SchemaDiff[]): {
        conflict: boolean;
        previousResult?: StoredResult;
        reason?: string;
        canReuse?: boolean;
    };
    storeResult(result: Omit<StoredResult, 'id' | 'createdAt' | 'updatedAt'>): StoredResult;
    addHumanRemark(resultId: string, remark: string, operator: string): StoredResult | null;
    confirmResult(resultId: string, confirmed: boolean, operator: string): StoredResult | null;
    private loadResults;
    private saveResults;
    private storeFailure;
    loadFailures(): StoredResult[];
    getFailuresByGroup(group: string): StoredResult[];
    getFailureGroups(): string[];
    getPartitions(): LakehousePartition[];
    confirmPartition(partitionName: string, operator: string): LakehousePartition | null;
    addPartitions(partitions: Omit<LakehousePartition, 'humanConfirmed'>[]): void;
    addOrUpdatePartitions(partitions: Omit<LakehousePartition, 'humanConfirmed'>[]): void;
    getUnconfirmedPartitions(): LakehousePartition[];
    filterByFailure(items: BatchItem[], failureGroup: string): BatchItem[];
    getAllResults(): StoredResult[];
}
