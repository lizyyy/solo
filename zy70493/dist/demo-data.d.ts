export declare function generateDemoData(batchId?: string): Promise<{
    batchId: string;
    renewalsCount: number;
    whitelistCount: number;
    labSamplesCount: number;
    abnormalCount: number;
}>;
export declare function getDemoDataInfo(): string;
