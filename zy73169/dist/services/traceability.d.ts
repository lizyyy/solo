import type { Sample, FittingSession, ChangeRecord, FittingResult, FittingMethod } from '../models/types';
export declare function updateSampleField(session: FittingSession, sampleId: string, field: keyof Sample, newValue: unknown, changedBy: string, reason?: string): Sample | null;
export declare function confirmSample(session: FittingSession, sampleId: string, confirmedBy: string): Sample | null;
export declare function withdrawSample(session: FittingSession, sampleId: string, withdrawnBy: string, reason: string): Sample | null;
export declare function addSample(session: FittingSession, x: number, y: number, source: Sample['source'], addedBy: string): Sample;
export declare function getSampleChangeHistory(session: FittingSession, sampleId: string): ChangeRecord[];
export declare function getSampleSourceInfo(sample: Sample): string;
export interface ConfirmationDiff {
    sampleId: string;
    field: string;
    before: unknown;
    after: unknown;
    changedBy: string;
    changedAt: number;
    reason?: string;
    id?: string;
}
export declare function getConfirmationDiffs(session: FittingSession, sampleId: string): ConfirmationDiff[];
export declare function recalculateWithWithdrawn(session: FittingSession, withdrawnSampleId: string, method: FittingMethod, calculatedBy: string, degree?: number): {
    before: FittingResult;
    after: FittingResult;
} | null;
export declare function verifyCalibrationConsistency(session: FittingSession, fittingId: string): {
    consistent: boolean;
    mismatches: Array<{
        sampleId: string;
        chartValue: number;
        detailValue: number;
    }>;
};
export declare function getDirtySamples(session: FittingSession): Sample[];
export declare function getRawSamples(session: FittingSession): Sample[];
