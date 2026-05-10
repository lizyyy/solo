"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateTotalBudget = calculateTotalBudget;
exports.calculateDeductionAmount = calculateDeductionAmount;
exports.calculateBudgetPercentage = calculateBudgetPercentage;
exports.calculateBudgetUtilization = calculateBudgetUtilization;
const enums_1 = require("../types/enums");
const timeWindow_1 = require("./timeWindow");
function calculateTotalBudget(sloType, targetValue, windowType, totalRequests = 10000) {
    const windowDurationMs = (0, timeWindow_1.calculateTimeWindowDurationMs)(windowType);
    const allowedFailureRate = (100 - targetValue) / 100;
    switch (sloType) {
        case enums_1.SLOType.AVAILABILITY:
        case enums_1.SLOType.ERROR_RATE:
            return Math.floor(totalRequests * allowedFailureRate);
        case enums_1.SLOType.LATENCY:
            return Math.floor(totalRequests * allowedFailureRate);
        default:
            return Math.floor(totalRequests * allowedFailureRate);
    }
}
function calculateDeductionAmount(sloType, metadata) {
    switch (sloType) {
        case enums_1.SLOType.AVAILABILITY:
        case enums_1.SLOType.ERROR_RATE:
            return 1;
        case enums_1.SLOType.LATENCY:
            const duration = metadata?.durationMs || 0;
            const expected = metadata?.expectedDurationMs || 500;
            if (duration <= expected)
                return 0;
            const excessRatio = (duration - expected) / expected;
            return Math.max(1, Math.floor(excessRatio * 2));
        default:
            return 1;
    }
}
function calculateBudgetPercentage(remaining, total) {
    if (total <= 0)
        return 0;
    return Math.round((remaining / total) * 100 * 100) / 100;
}
function calculateBudgetUtilization(used, total) {
    if (total <= 0)
        return 0;
    return Math.round((used / total) * 100 * 100) / 100;
}
//# sourceMappingURL=budgetCalculator.js.map