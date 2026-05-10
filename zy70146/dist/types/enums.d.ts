export declare const SLOType: {
    readonly AVAILABILITY: "AVAILABILITY";
    readonly LATENCY: "LATENCY";
    readonly ERROR_RATE: "ERROR_RATE";
};
export type SLOType = (typeof SLOType)[keyof typeof SLOType];
export declare const TimeWindowType: {
    readonly DAILY: "DAILY";
    readonly WEEKLY: "WEEKLY";
    readonly MONTHLY: "MONTHLY";
    readonly ROLLING_24H: "ROLLING_24H";
    readonly ROLLING_7D: "ROLLING_7D";
    readonly ROLLING_30D: "ROLLING_30D";
};
export type TimeWindowType = (typeof TimeWindowType)[keyof typeof TimeWindowType];
export declare const ErrorSource: {
    readonly API: "API";
    readonly INTERNAL: "INTERNAL";
    readonly EXTERNAL: "EXTERNAL";
    readonly MANUAL: "MANUAL";
};
export type ErrorSource = (typeof ErrorSource)[keyof typeof ErrorSource];
export declare const FreezeReason: {
    readonly BUDGET_EXHAUSTED: "BUDGET_EXHAUSTED";
    readonly MANUAL_FREEZE: "MANUAL_FREEZE";
    readonly MAINTENANCE: "MAINTENANCE";
    readonly INCIDENT: "INCIDENT";
};
export type FreezeReason = (typeof FreezeReason)[keyof typeof FreezeReason];
export declare const ProcessStatus: {
    readonly PENDING: "PENDING";
    readonly IN_PROGRESS: "IN_PROGRESS";
    readonly APPROVED: "APPROVED";
    readonly REJECTED: "REJECTED";
    readonly COMPLETED: "COMPLETED";
};
export type ProcessStatus = (typeof ProcessStatus)[keyof typeof ProcessStatus];
export declare const ProcessStep: {
    readonly SLO_CONFIG_REVIEW: "SLO_CONFIG_REVIEW";
    readonly ERROR_SAMPLE_VALIDATION: "ERROR_SAMPLE_VALIDATION";
    readonly BUDGET_DEDUCTION: "BUDGET_DEDUCTION";
    readonly BUDGET_FREEZE: "BUDGET_FREEZE";
    readonly ALERT_SUPPRESSION: "ALERT_SUPPRESSION";
    readonly REPORT_GENERATION: "REPORT_GENERATION";
};
export type ProcessStep = (typeof ProcessStep)[keyof typeof ProcessStep];
export declare const SLOTypeValues: ("AVAILABILITY" | "LATENCY" | "ERROR_RATE")[];
export declare const TimeWindowTypeValues: ("DAILY" | "WEEKLY" | "MONTHLY" | "ROLLING_24H" | "ROLLING_7D" | "ROLLING_30D")[];
export declare const ErrorSourceValues: ("API" | "INTERNAL" | "EXTERNAL" | "MANUAL")[];
export declare const FreezeReasonValues: ("BUDGET_EXHAUSTED" | "MANUAL_FREEZE" | "MAINTENANCE" | "INCIDENT")[];
export declare const ProcessStatusValues: ("PENDING" | "IN_PROGRESS" | "APPROVED" | "REJECTED" | "COMPLETED")[];
export declare const ProcessStepValues: ("SLO_CONFIG_REVIEW" | "ERROR_SAMPLE_VALIDATION" | "BUDGET_DEDUCTION" | "BUDGET_FREEZE" | "ALERT_SUPPRESSION" | "REPORT_GENERATION")[];
