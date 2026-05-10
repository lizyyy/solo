import { ApiResponse } from '../types';
export declare const successResponse: <T>(data: T, message?: string) => ApiResponse<T>;
export declare const errorResponse: (message: string, errorCode?: string) => ApiResponse;
export declare class AppError extends Error {
    readonly errorCode: string;
    readonly statusCode: number;
    constructor(message: string, errorCode?: string, statusCode?: number);
}
export declare const errorCodes: {
    VALIDATION_ERROR: string;
    NOT_FOUND: string;
    CONFLICT: string;
    FORBIDDEN: string;
    BAD_REQUEST: string;
    INTERNAL_ERROR: string;
    IDEMPOTENT_CONFLICT: string;
    SAMPLE_FROZEN: string;
    INVALID_STATUS_TRANSITION: string;
    TASK_NOT_FOUND: string;
    DUPLICATE_OPERATION: string;
};
