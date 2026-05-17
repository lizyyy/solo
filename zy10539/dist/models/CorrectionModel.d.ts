import type { CorrectionRequest, CorrectionReport, ExceptionRecord, RollbackPoint } from '../types';
declare class CorrectionStorage {
    private corrections;
    private reports;
    private exceptions;
    private rollbackPoints;
    saveCorrection(correction: CorrectionRequest): Promise<CorrectionRequest>;
    getCorrection(id: string): Promise<CorrectionRequest | undefined>;
    listCorrections(filters?: {
        status?: string;
        applicant?: string;
        department?: string;
    }): Promise<CorrectionRequest[]>;
    saveReport(report: CorrectionReport): Promise<CorrectionReport>;
    getReport(id: string): Promise<CorrectionReport | undefined>;
    getReportsByCorrection(correctionId: string): Promise<CorrectionReport[]>;
    saveException(exception: ExceptionRecord): Promise<ExceptionRecord>;
    getExceptionsByCorrection(correctionId: string): Promise<ExceptionRecord[]>;
    saveRollbackPoint(point: RollbackPoint): Promise<RollbackPoint>;
    getRollbackPointsByCorrection(correctionId: string): Promise<RollbackPoint[]>;
}
export declare const correctionStorage: CorrectionStorage;
export {};
