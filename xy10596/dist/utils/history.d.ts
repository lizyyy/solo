import { HistoryEntry, SurveyStatus, SurveyRecord } from '../types';
export declare class HistoryManager {
    static createEntry(action: string, toStatus: SurveyStatus, actor?: 'system' | string, options?: {
        fromStatus?: SurveyStatus;
        reason?: string;
        details?: Record<string, any>;
    }): HistoryEntry;
    static addToRecord(record: SurveyRecord, action: string, toStatus: SurveyStatus, actor?: 'system' | string, options?: {
        reason?: string;
        details?: Record<string, any>;
    }): SurveyRecord;
    static getLastEntry(record: SurveyRecord): HistoryEntry | undefined;
    static getHistoryByActor(record: SurveyRecord, actor: string): HistoryEntry[];
    static getStatusChanges(record: SurveyRecord): {
        from: SurveyStatus | undefined;
        to: SurveyStatus;
        timestamp: string;
    }[];
    static formatHistory(history: HistoryEntry[]): string[];
}
