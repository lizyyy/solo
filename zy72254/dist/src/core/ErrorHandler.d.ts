import { UserFriendlyError } from '../types';
export type ErrorCode = 'IMPORT_DUPLICATE' | 'CONFLICT_DETECTED' | 'INVALID_RANGEFINDER' | 'MISSING_CAD_DATA' | 'INVALID_GEOMETRY' | 'PERMISSION_DENIED' | 'NOT_FOUND' | 'INVALID_OPERATION' | 'ROLLBACK_FAILED' | 'MERGE_FAILED' | 'VALIDATION_ERROR';
export declare function createError(code: ErrorCode, details?: Record<string, unknown>): UserFriendlyError;
export declare function formatErrorForDisplay(error: UserFriendlyError): {
    title: string;
    content: string;
    suggestion: string;
    timestamp: string;
};
export declare function validateRequiredFields(data: Record<string, unknown>, requiredFields: string[]): {
    valid: boolean;
    errors: string[];
};
export declare class ErrorCollector {
    private errors;
    add(error: UserFriendlyError): void;
    addError(code: ErrorCode, details?: Record<string, unknown>): void;
    getAll(): UserFriendlyError[];
    hasErrors(): boolean;
    getErrorCount(): number;
    formatAll(): Array<ReturnType<typeof formatErrorForDisplay>>;
    clear(): void;
    throwIfErrors(): void;
}
export declare function wrapWithErrorHandling<T>(fn: () => T, errorCode?: ErrorCode, errorDetails?: Record<string, unknown>): T;
export declare function wrapAsyncWithErrorHandling<T>(fn: () => Promise<T>, errorCode?: ErrorCode, errorDetails?: Record<string, unknown>): Promise<T>;
