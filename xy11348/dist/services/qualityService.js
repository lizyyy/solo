"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QualityService = void 0;
class QualityService {
    db;
    constructor(db) {
        this.db = db;
    }
    calculateDelta(measured, standard) {
        const deltaL = measured.L - standard.L;
        const deltaA = measured.a - standard.a;
        const deltaB = measured.b - standard.b;
        const deltaE = Math.sqrt(deltaL * deltaL + deltaA * deltaA + deltaB * deltaB);
        return { deltaL, deltaA, deltaB, deltaE };
    }
    checkPass(delta, threshold) {
        const details = {
            deltaL: Math.abs(delta.deltaL),
            deltaLMax: threshold.deltaLMax,
            deltaA: Math.abs(delta.deltaA),
            deltaAMax: threshold.deltaAMax,
            deltaB: Math.abs(delta.deltaB),
            deltaBMax: threshold.deltaBMax,
            deltaE: delta.deltaE,
            deltaEMax: threshold.deltaEMax
        };
        const failures = [];
        if (Math.abs(delta.deltaL) > threshold.deltaLMax) {
            failures.push(`L值偏差${Math.abs(delta.deltaL).toFixed(2)}超过阈值${threshold.deltaLMax}`);
        }
        if (Math.abs(delta.deltaA) > threshold.deltaAMax) {
            failures.push(`a值偏差${Math.abs(delta.deltaA).toFixed(2)}超过阈值${threshold.deltaAMax}`);
        }
        if (Math.abs(delta.deltaB) > threshold.deltaBMax) {
            failures.push(`b值偏差${Math.abs(delta.deltaB).toFixed(2)}超过阈值${threshold.deltaBMax}`);
        }
        if (delta.deltaE > threshold.deltaEMax) {
            failures.push(`总色差${delta.deltaE.toFixed(2)}超过阈值${threshold.deltaEMax}`);
        }
        if (failures.length === 0) {
            return {
                isPass: true,
                reason: { code: 'PASS', message: '所有指标在公差范围内', details }
            };
        }
        return {
            isPass: false,
            reason: { code: 'FAIL', message: failures.join('; '), details }
        };
    }
    shouldRetainSample(isPass, delta, threshold) {
        const warningThreshold = threshold.deltaEMax * 0.8;
        return !isPass || delta.deltaE >= warningThreshold;
    }
    processMeasurement(printBatchId, measurementData) {
        const printBatch = this.db.getPrintBatchByBatchNo('');
        const printBatchInfo = this.db.getDatabase().prepare('SELECT thresholdId FROM print_batches WHERE id = ?').get(printBatchId);
        if (!printBatchInfo) {
            throw new Error(`印刷批次 ${printBatchId} 不存在`);
        }
        const threshold = this.db.getThresholdById(printBatchInfo.thresholdId);
        if (!threshold) {
            throw new Error(`阈值配置不存在`);
        }
        const delta = this.calculateDelta({ L: measurementData.L, a: measurementData.a, b: measurementData.b }, { L: threshold.standardL, a: threshold.standardA, b: threshold.standardB });
        const { isPass, reason } = this.checkPass(delta, threshold);
        const isRetained = this.shouldRetainSample(isPass, delta, threshold);
        const measurementId = this.db.insertMeasurement({
            printBatchId,
            measurementPoint: measurementData.measurementPoint,
            L: measurementData.L,
            a: measurementData.a,
            b: measurementData.b,
            deltaL: delta.deltaL,
            deltaA: delta.deltaA,
            deltaB: delta.deltaB,
            deltaE: delta.deltaE,
            isPass,
            isRetained,
            measuredAt: measurementData.measuredAt,
            measuredBy: measurementData.measuredBy,
            notes: measurementData.notes
        });
        return { measurementId, isPass, reason, isRetained };
    }
    batchProcessMeasurements(printBatchId, measurements) {
        const success = [];
        const failed = [];
        for (let i = 0; i < measurements.length; i++) {
            try {
                const result = this.db.transaction(() => {
                    return this.processMeasurement(printBatchId, measurements[i]);
                });
                success.push({
                    measurementPoint: measurements[i].measurementPoint,
                    isPass: result.isPass,
                    reason: result.reason.message,
                    isRetained: result.isRetained
                });
            }
            catch (error) {
                failed.push({
                    index: i,
                    data: measurements[i],
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        return { success, failed };
    }
    evaluateBatch(printBatchNo) {
        const printBatch = this.db.getPrintBatchByBatchNo(printBatchNo);
        if (!printBatch) {
            throw new Error(`印刷批次 ${printBatchNo} 不存在`);
        }
        const measurements = this.db.getMeasurementsByPrintBatchId(printBatch.id);
        const passCount = measurements.filter(m => m.isPass).length;
        const failCount = measurements.length - passCount;
        const passRate = measurements.length > 0 ? passCount / measurements.length : 0;
        let overallResult = 'pass';
        if (passRate < 0.95) {
            overallResult = 'fail';
        }
        else if (passRate < 1.0) {
            overallResult = 'warning';
        }
        return {
            overallResult,
            passRate,
            passCount,
            failCount,
            totalCount: measurements.length
        };
    }
    getBatchTrend(days = 30) {
        const query = `
      SELECT 
        DATE(pb.printDate) as date,
        COUNT(DISTINCT pb.id) as batchCount,
        AVG(CASE WHEN m.isPass = 1 THEN 1.0 ELSE 0.0 END) as passRate,
        AVG(m.deltaE) as avgDeltaE
      FROM print_batches pb
      LEFT JOIN measurements m ON pb.id = m.printBatchId
      WHERE pb.printDate >= DATE('now', '-' || ? || ' days')
      GROUP BY DATE(pb.printDate)
      ORDER BY date DESC
    `;
        const stmt = this.db.getDatabase().prepare(query);
        const results = stmt.all(days);
        return results.map(r => ({
            ...r,
            passRate: Number(r.passRate.toFixed(4)),
            avgDeltaE: Number(r.avgDeltaE.toFixed(4))
        }));
    }
    generateReportNo(batchNo) {
        const timestamp = new Date().toISOString().replace(/[-T:.]/g, '').slice(0, 14);
        return `QC-${batchNo}-${timestamp}`;
    }
}
exports.QualityService = QualityService;
//# sourceMappingURL=qualityService.js.map