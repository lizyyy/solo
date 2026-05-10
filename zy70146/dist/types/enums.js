"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessStepValues = exports.ProcessStatusValues = exports.FreezeReasonValues = exports.ErrorSourceValues = exports.TimeWindowTypeValues = exports.SLOTypeValues = exports.ProcessStep = exports.ProcessStatus = exports.FreezeReason = exports.ErrorSource = exports.TimeWindowType = exports.SLOType = void 0;
exports.SLOType = {
    AVAILABILITY: 'AVAILABILITY',
    LATENCY: 'LATENCY',
    ERROR_RATE: 'ERROR_RATE',
};
exports.TimeWindowType = {
    DAILY: 'DAILY',
    WEEKLY: 'WEEKLY',
    MONTHLY: 'MONTHLY',
    ROLLING_24H: 'ROLLING_24H',
    ROLLING_7D: 'ROLLING_7D',
    ROLLING_30D: 'ROLLING_30D',
};
exports.ErrorSource = {
    API: 'API',
    INTERNAL: 'INTERNAL',
    EXTERNAL: 'EXTERNAL',
    MANUAL: 'MANUAL',
};
exports.FreezeReason = {
    BUDGET_EXHAUSTED: 'BUDGET_EXHAUSTED',
    MANUAL_FREEZE: 'MANUAL_FREEZE',
    MAINTENANCE: 'MAINTENANCE',
    INCIDENT: 'INCIDENT',
};
exports.ProcessStatus = {
    PENDING: 'PENDING',
    IN_PROGRESS: 'IN_PROGRESS',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    COMPLETED: 'COMPLETED',
};
exports.ProcessStep = {
    SLO_CONFIG_REVIEW: 'SLO_CONFIG_REVIEW',
    ERROR_SAMPLE_VALIDATION: 'ERROR_SAMPLE_VALIDATION',
    BUDGET_DEDUCTION: 'BUDGET_DEDUCTION',
    BUDGET_FREEZE: 'BUDGET_FREEZE',
    ALERT_SUPPRESSION: 'ALERT_SUPPRESSION',
    REPORT_GENERATION: 'REPORT_GENERATION',
};
exports.SLOTypeValues = Object.values(exports.SLOType);
exports.TimeWindowTypeValues = Object.values(exports.TimeWindowType);
exports.ErrorSourceValues = Object.values(exports.ErrorSource);
exports.FreezeReasonValues = Object.values(exports.FreezeReason);
exports.ProcessStatusValues = Object.values(exports.ProcessStatus);
exports.ProcessStepValues = Object.values(exports.ProcessStep);
//# sourceMappingURL=enums.js.map