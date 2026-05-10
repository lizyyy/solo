export declare class BusinessError extends Error {
    readonly code: string;
    readonly details?: Record<string, unknown> | undefined;
    constructor(message: string, code: string, details?: Record<string, unknown> | undefined);
}
export declare class InvalidStateTransitionError extends BusinessError {
    readonly allowedTransitions: string[];
    constructor(fromStatus: string, toStatus: string, allowedTransitions: string[]);
}
export declare class DuplicateSubmissionError extends BusinessError {
    readonly operationType: string;
    readonly batchId: string;
    constructor(operationType: string, batchId: string);
}
export declare class BatchNotFoundError extends BusinessError {
    readonly batchId: string;
    constructor(batchId: string);
}
export declare class ValidationError extends BusinessError {
    readonly field?: string | undefined;
    constructor(message: string, field?: string | undefined, details?: Record<string, unknown>);
}
export declare class InspectionRequiredError extends BusinessError {
    readonly missingInspections: string[];
    constructor(missingInspections: string[]);
}
export declare class ConcurrencyConflictError extends BusinessError {
    readonly batchId: string;
    readonly expectedVersion: number;
    readonly actualVersion: number;
    constructor(batchId: string, expectedVersion: number, actualVersion: number);
}
