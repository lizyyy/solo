export declare const ConfigStatus: {
    readonly DRAFT: "DRAFT";
    readonly PUBLISHED: "PUBLISHED";
    readonly DEPRECATED: "DEPRECATED";
};
export type ConfigStatus = typeof ConfigStatus[keyof typeof ConfigStatus];
export declare const InstanceStatus: {
    readonly ONLINE: "ONLINE";
    readonly OFFLINE: "OFFLINE";
    readonly UNHEALTHY: "UNHEALTHY";
};
export type InstanceStatus = typeof InstanceStatus[keyof typeof InstanceStatus];
export declare const PullStatus: {
    readonly SUCCESS: "SUCCESS";
    readonly FAILED: "FAILED";
    readonly PENDING: "PENDING";
    readonly TIMEOUT: "TIMEOUT";
};
export type PullStatus = typeof PullStatus[keyof typeof PullStatus];
export declare const EffectiveStatus: {
    readonly EFFECTIVE: "EFFECTIVE";
    readonly NOT_EFFECTIVE: "NOT_EFFECTIVE";
    readonly PARTIAL: "PARTIAL";
    readonly UNKNOWN: "UNKNOWN";
};
export type EffectiveStatus = typeof EffectiveStatus[keyof typeof EffectiveStatus];
export declare const CompensateStatus: {
    readonly NOT_NEEDED: "NOT_NEEDED";
    readonly PENDING: "PENDING";
    readonly IN_PROGRESS: "IN_PROGRESS";
    readonly COMPLETED: "COMPLETED";
    readonly FAILED: "FAILED";
};
export type CompensateStatus = typeof CompensateStatus[keyof typeof CompensateStatus];
