import { ProcessingResult, ReplaySession } from '../types';
import { ImportOptions } from '../import/csv-importer';
interface ReplayCommand {
    id: string;
    timestamp: number;
    command: string;
    args: Record<string, unknown>;
    recordIndex?: number;
    result?: ProcessingResult<unknown>;
}
interface ReplayManifest {
    sessionId: string;
    createdAt: number;
    createdBy: string;
    description: string;
    commands: ReplayCommand[];
}
export declare function createReplayManifest(createdBy: string, description: string, commands: ReplayCommand[]): ReplayManifest;
export declare function saveReplayManifest(manifest: ReplayManifest): void;
export declare function listReplaySessions(): ProcessingResult<Array<{
    sessionId: string;
    createdAt: string;
    createdBy: string;
    description: string;
    commandCount: number;
}>>;
export declare function executeReplay(sessionId: string, operator: string, clearDataBefore?: boolean): Promise<ProcessingResult<ReplaySession>>;
export declare function generateReplayReport(session: ReplaySession): string;
export declare function createWorkflowReplayCommands(importOptions: ImportOptions, annotations: Array<{
    recordIndex: number;
    content: string;
    author: string;
    screenshotRef?: string;
}>, reviews: Array<{
    recordIndex: number;
    reviewer: string;
    decision: 'approve' | 'reject' | 'rollback';
    comment: string;
}>, updates: Array<{
    recordIndex: number;
    operator: string;
    fieldValues: Record<string, string>;
    reason: string;
}>, importedRecordIds: string[]): ReplayCommand[];
export declare function getTraceabilityReport(recordId: string): ProcessingResult<string>;
export {};
