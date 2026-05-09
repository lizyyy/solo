"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_DEVIATION_CONFIG = void 0;
exports.calculateDeviation = calculateDeviation;
exports.calculateAverage = calculateAverage;
exports.validateExecutionRecords = validateExecutionRecords;
exports.DEFAULT_DEVIATION_CONFIG = {
    passThreshold: 0.8,
    minValidRecords: 1
};
function calculateDeviation(executionRecords, declaredCapacity, config = exports.DEFAULT_DEVIATION_CONFIG) {
    if (!executionRecords || executionRecords.length === 0) {
        return {
            success: false,
            error: {
                code: 'NO_EXECUTION_RECORDS',
                message: '没有找到执行记录，无法计算偏差',
                details: { declaredCapacity }
            }
        };
    }
    if (executionRecords.length < config.minValidRecords) {
        return {
            success: false,
            error: {
                code: 'INSUFFICIENT_RECORDS',
                message: `执行记录数量不足，需要至少 ${config.minValidRecords} 条，当前只有 ${executionRecords.length} 条`,
                details: {
                    required: config.minValidRecords,
                    actual: executionRecords.length
                }
            }
        };
    }
    if (declaredCapacity <= 0) {
        return {
            success: false,
            error: {
                code: 'INVALID_DECLARED_CAPACITY',
                message: '申报容量必须大于 0',
                details: { declaredCapacity }
            }
        };
    }
    const averageBaseline = calculateAverage(executionRecords.map(r => r.baselineLoad));
    const averageActual = calculateAverage(executionRecords.map(r => r.actualLoad));
    const achievedReduction = Math.max(0, averageBaseline - averageActual);
    const expectedReduction = declaredCapacity;
    const deviationRate = expectedReduction > 0 ? achievedReduction / expectedReduction : 0;
    const isPassed = deviationRate >= config.passThreshold;
    const result = {
        enrollmentId: executionRecords[0].enrollmentId,
        averageBaseline,
        averageActual,
        achievedReduction,
        expectedReduction,
        deviationRate: parseFloat(deviationRate.toFixed(4)),
        passThreshold: config.passThreshold,
        isPassed,
        calculatedAt: new Date()
    };
    return {
        success: true,
        data: result
    };
}
function calculateAverage(values) {
    if (values.length === 0)
        return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
}
function validateExecutionRecords(executionRecords, batchStartTime, batchEndTime) {
    const warnings = [];
    const errors = [];
    if (executionRecords.length === 0) {
        errors.push('没有找到执行记录');
        return { isValid: false, warnings, errors };
    }
    const recordsInRange = executionRecords.filter(r => r.timestamp >= batchStartTime && r.timestamp <= batchEndTime);
    if (recordsInRange.length < executionRecords.length) {
        warnings.push(`存在 ${executionRecords.length - recordsInRange.length} 条记录不在执行时间范围内`);
    }
    const invalidLoadRecords = executionRecords.filter(r => r.actualLoad < 0 || r.baselineLoad < 0);
    if (invalidLoadRecords.length > 0) {
        errors.push(`存在 ${invalidLoadRecords.length} 条记录的负荷值为负数`);
    }
    const baselineHigherRecords = executionRecords.filter(r => r.actualLoad > r.baselineLoad);
    if (baselineHigherRecords.length > 0) {
        warnings.push(`存在 ${baselineHigherRecords.length} 条记录的实际负荷高于基线负荷`);
    }
    return {
        isValid: errors.length === 0,
        warnings,
        errors
    };
}
//# sourceMappingURL=deviationCalculator.js.map