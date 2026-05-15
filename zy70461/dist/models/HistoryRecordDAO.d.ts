import { HistoryRecord } from './types';
export declare class HistoryRecordDAO {
    static create(record: Omit<HistoryRecord, 'id' | 'changedAt'>): HistoryRecord;
    static getById(id: string): HistoryRecord | null;
    static getBySubmissionId(submissionId: string): HistoryRecord[];
    static getBySourceSystem(sourceSystem: string): HistoryRecord[];
    static getAll(limit?: number): HistoryRecord[];
    private static mapRow;
}
