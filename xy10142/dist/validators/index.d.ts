import type { AuditEvent, ValidationError, ValidationResult } from '../types/index.js';
export declare function createValidationError(field: string, message: string, value?: unknown): ValidationError;
export declare function isNonEmptyString(value: unknown): value is string;
export declare function isPositiveNumber(value: unknown): value is number;
export declare function isValidTimestamp(value: unknown): value is number;
export declare function validateEventId(id: string, fieldName?: string): ValidationError | null;
export declare function validateUserId(userId: string): ValidationError | null;
export declare function validateTimestamp(timestamp: number): ValidationError | null;
export declare function validateEventType(type: string): ValidationError | null;
export declare function validateResourceId(resourceId: string): ValidationError | null;
export declare function validateColor(color: string, fieldName?: string): ValidationError | null;
export declare function validateAuditEvent(event: unknown, existingEvents?: AuditEvent[]): ValidationResult;
export declare function validateEventGroup(group: unknown, existingEvents?: AuditEvent[]): ValidationResult;
export declare function validateTimelineOptions(options: unknown): ValidationResult;
export declare function validateSearchOptions(options: unknown): ValidationResult;
export declare function validateExportOptions(options: unknown): ValidationResult;
export declare class ValidationException extends Error {
    readonly errors: ValidationError[];
    constructor(message: string, errors: ValidationError[]);
}
export declare function assertValid(result: ValidationResult, message?: string): void;
//# sourceMappingURL=index.d.ts.map