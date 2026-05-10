import { VulnerabilityStatus, Severity, AssignmentValidationResult, StatusChangeValidationResult, DelayRequestValidationResult } from '../types';
export declare const MAX_DELAY_COUNT = 3;
export declare const MIN_REASON_LENGTH = 20;
export declare const MAX_DELAY_DAYS: {
    CRITICAL: number;
    HIGH: number;
    MEDIUM: number;
    LOW: number;
};
export declare const ALLOWED_STATUS_TRANSITIONS: Record<VulnerabilityStatus, VulnerabilityStatus[]>;
export declare class BusinessRuleValidator {
    static validateAssignment(vulnerabilityStatus: VulnerabilityStatus, currentAssigneeId: string | null, assigneeId: string, isManualOverride?: boolean): AssignmentValidationResult;
    static validateStatusTransition(fromStatus: VulnerabilityStatus, toStatus: VulnerabilityStatus, assigneeId: string | null, manuallyCorrected: boolean, isManualOverride?: boolean): StatusChangeValidationResult;
    static validateDelayRequest(vulnerabilityStatus: VulnerabilityStatus, currentDelayCount: number, severity: Severity, originalDueDate: Date, newDueDate: Date, reason: string, riskMitigation: string, isManualOverride?: boolean): DelayRequestValidationResult;
    static calculateRepairWindow(severity: Severity, discoveredDate?: Date): {
        dueDate: Date;
        recommendedDays: number;
        description: string;
    };
    static checkBatchConsistency(batchStatus: string, vulnerabilities: {
        status: VulnerabilityStatus;
    }[]): {
        consistent: boolean;
        issues: string[];
    };
    static validateRepeatAssignment(vulnerabilityId: string, assigneeId: string, existingAssignments: {
        vulnerabilityId: string;
        assigneeId: string;
        isActive: boolean;
    }[]): {
        isRepeat: boolean;
        lastAssignment?: typeof existingAssignments[0];
    };
}
