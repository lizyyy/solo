import { ProcessReport } from './types';
export declare class ProcessReportDAO {
    static create(report: Omit<ProcessReport, 'id' | 'generatedAt'>): ProcessReport;
    static getById(id: string): ProcessReport | null;
    static getByBatchId(batchId: string): ProcessReport[];
    static getAll(limit?: number): ProcessReport[];
    private static mapRow;
}
