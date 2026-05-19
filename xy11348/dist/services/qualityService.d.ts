import { QualityControlDB } from '../database/db';
import { Threshold, DecisionReason, BatchResult } from '../types';
export declare class QualityService {
    private db;
    constructor(db: QualityControlDB);
    calculateDelta(measured: {
        L: number;
        a: number;
        b: number;
    }, standard: {
        L: number;
        a: number;
        b: number;
    }): {
        deltaL: number;
        deltaA: number;
        deltaB: number;
        deltaE: number;
    };
    checkPass(delta: {
        deltaL: number;
        deltaA: number;
        deltaB: number;
        deltaE: number;
    }, threshold: Threshold): {
        isPass: boolean;
        reason: DecisionReason;
    };
    shouldRetainSample(isPass: boolean, delta: {
        deltaE: number;
    }, threshold: Threshold): boolean;
    processMeasurement(printBatchId: number, measurementData: {
        measurementPoint: string;
        L: number;
        a: number;
        b: number;
        measuredAt: string;
        measuredBy: string;
        notes?: string;
    }): {
        measurementId: number;
        isPass: boolean;
        reason: DecisionReason;
        isRetained: boolean;
    };
    batchProcessMeasurements(printBatchId: number, measurements: Array<{
        measurementPoint: string;
        L: number;
        a: number;
        b: number;
        measuredAt: string;
        measuredBy: string;
        notes?: string;
    }>): BatchResult<{
        measurementPoint: string;
        isPass: boolean;
        reason: string;
        isRetained: boolean;
    }>;
    evaluateBatch(printBatchNo: string): {
        overallResult: 'pass' | 'fail' | 'warning';
        passRate: number;
        passCount: number;
        failCount: number;
        totalCount: number;
    };
    getBatchTrend(days?: number): Array<{
        date: string;
        passRate: number;
        batchCount: number;
        avgDeltaE: number;
    }>;
    generateReportNo(batchNo: string): string;
}
