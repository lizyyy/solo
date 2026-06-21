import type { FittingSession, FittingMethod, FittingResult, SampleSource, Sample } from '../models/types';
import { type ConfirmationDiff, type ConsistencyMismatch } from './traceability';
export interface PlaybackResult {
    session: FittingSession;
    fittingResult: FittingResult;
    equation: string;
    anomalySummary: Record<string, number>;
    isolatedSamples: {
        normal: Sample[];
        anomalous: Sample[];
    };
}
export interface ReplayWithWithdrawnResult {
    before: {
        fittingResult: FittingResult;
        equation: string;
        rSquared: number;
    };
    after: {
        fittingResult: FittingResult;
        equation: string;
        rSquared: number;
    };
    diff: {
        rSquaredChange: number;
        coefficientChanges: Array<{
            index: number;
            before: number;
            after: number;
            change: number;
        }>;
    };
}
export declare class FittingService {
    private sessions;
    createSession(name: string, createdBy: string): FittingSession;
    getSession(sessionId: string): FittingSession | undefined;
    getAllSessions(): FittingSession[];
    addSamples(sessionId: string, dataPoints: Array<{
        x: number;
        y: number;
        source: SampleSource;
    }>, addedBy: string): Sample[];
    runFitting(sessionId: string, method: FittingMethod, calculatedBy: string, excludeAnomalies?: boolean, degree?: number): PlaybackResult;
    confirmSample(sessionId: string, sampleId: string, confirmedBy: string, notes?: string): Sample | null;
    correctSampleValue(sessionId: string, sampleId: string, field: 'x' | 'y', newValue: number, correctedBy: string, notes?: string): Sample | null;
    withdrawSample(sessionId: string, sampleId: string, withdrawnBy: string, reason: string): Sample | null;
    updateSample(sessionId: string, sampleId: string, field: keyof Sample, newValue: unknown, changedBy: string, reason?: string): Sample | null;
    getSampleHistory(sessionId: string, sampleId: string): {
        history: import("../models/types").ChangeRecord[];
        sourceInfo: string;
        confirmationDiffs: ConfirmationDiff[];
    };
    getConfirmationDiffs(sessionId: string, sampleId: string): ConfirmationDiff[];
    replayWithWithdrawn(sessionId: string, withdrawnSampleId: string, method: FittingMethod, calculatedBy: string, degree?: number): ReplayWithWithdrawnResult | null;
    verifyConsistency(sessionId: string, fittingId: string): {
        consistent: boolean;
        mismatches: ConsistencyMismatch[];
    };
    getAnomalySummary(sessionId: string): Record<string, number>;
}
export declare const fittingService: FittingService;
