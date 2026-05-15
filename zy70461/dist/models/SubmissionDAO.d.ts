import { Submission, SubmissionStatus } from './types';
export declare class SubmissionDAO {
    static create(submission: Omit<Submission, 'id' | 'createdAt' | 'updatedAt'>): Submission;
    static getById(id: string): Submission | null;
    static getByBatchId(batchId: string): Submission[];
    static getByStatus(status: SubmissionStatus): Submission[];
    static getAll(limit?: number, offset?: number): Submission[];
    static update(id: string, updates: Partial<Omit<Submission, 'id' | 'createdAt'>>): Submission | null;
    static getStats(batchId?: string): {
        total: number;
        pending: number;
        approved: number;
        rejected: number;
        attachmentExpired: number;
    };
    static getDistinctBatchIds(): string[];
    private static toSnakeCase;
    private static mapRow;
}
