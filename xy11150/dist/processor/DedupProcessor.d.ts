import { ShuttleRegistration, ProcessResult } from '../models/ShuttleRegistration';
interface RunHistory {
    runId: string;
    processedAt: string;
    inputFiles: string[];
    recordHashes: string[];
    outputFingerprint: string;
}
export declare class DedupProcessor {
    private historyDir;
    private runId;
    constructor(outputDir: string);
    process(records: ShuttleRegistration[], outputDir: string): ProcessResult;
    private performDeduplication;
    private detectTransfers;
    private detectSharedPhones;
    private getDuplicateReason;
    private recordToHash;
    private generateRunId;
    private writeOutput;
    private writeReport;
    private saveRunHistory;
    findPreviousRun(records: ShuttleRegistration[]): RunHistory | null;
    private ensureDirectory;
}
export {};
