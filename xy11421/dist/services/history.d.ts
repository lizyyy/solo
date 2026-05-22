import { HistoryRecord, SourceType } from '../types';
export declare function recordHistory(sourceType: SourceType, sourceId: string, action: string, beforeData: any, afterData: any, performedBy: string, remark?: string): Promise<void>;
export declare function getHistoryBySource(sourceType: SourceType, sourceId: string): Promise<HistoryRecord[]>;
export declare function getAllHistory(limit?: number): Promise<HistoryRecord[]>;
export declare function getHistoryByUser(performedBy: string, limit?: number): Promise<HistoryRecord[]>;
export declare function printHistoryDiff(history: HistoryRecord): void;
