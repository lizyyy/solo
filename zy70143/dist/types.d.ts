export declare enum VulnerabilityStatus {
    NEW = "NEW",
    ASSIGNED = "ASSIGNED",
    IN_PROGRESS = "IN_PROGRESS",
    DELAYED = "DELAYED",
    FIXED = "FIXED",
    DEPLOYED = "DEPLOYED",
    CLOSED = "CLOSED"
}
export declare enum Severity {
    CRITICAL = "CRITICAL",
    HIGH = "HIGH",
    MEDIUM = "MEDIUM",
    LOW = "LOW"
}
export declare enum RiskLevel {
    EXTREME = "EXTREME",
    HIGH = "HIGH",
    MEDIUM = "MEDIUM",
    LOW = "LOW"
}
export declare enum BatchStatus {
    PLANNED = "PLANNED",
    IN_PROGRESS = "IN_PROGRESS",
    DEPLOYED = "DEPLOYED",
    CANCELLED = "CANCELLED"
}
export interface AssignmentValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}
export interface StatusChangeValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    requiresManualOverride?: boolean;
}
export interface DelayRequestValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    additionalRisk?: RiskLevel;
}
