import { LogisticsInterception, CompensationAction, SchemaDiff } from './types';
export declare class LogisticsProcessor {
    private differ;
    constructor();
    validateInterception(interception: LogisticsInterception, referenceSchema: any): {
        valid: boolean;
        failedPath?: string;
        schemaDiffs: SchemaDiff[];
        missingCompensations: CompensationAction[];
    };
    private interceptionToSchema;
    private checkCompensationActions;
    private detectFailedPath;
    createPreview(items: LogisticsInterception[]): {
        totalCount: number;
        willFail: number;
        willSucceed: number;
        failureGroups: Record<string, string[]>;
        affectedPartitions: string[];
    };
    private simulateProcessing;
    derivePartition(item: LogisticsInterception): string;
    groupByFailure(items: LogisticsInterception[]): Record<string, LogisticsInterception[]>;
}
