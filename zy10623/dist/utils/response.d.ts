import { ApiResponse } from '../types';
export { ApiResponse };
export declare enum BusinessErrorCode {
    SUCCESS = "SUCCESS",
    INVALID_STATUS_TRANSITION = "INVALID_STATUS_TRANSITION",
    IDEMPOTENT_CONFLICT = "IDEMPOTENT_CONFLICT",
    RECORD_NOT_FOUND = "RECORD_NOT_FOUND",
    ALREADY_REVIEWED = "ALREADY_REVIEWED",
    SPLIT_ORDER_BLOCKED = "SPLIT_ORDER_BLOCKED",
    CONCURRENT_CONFLICT = "CONCURRENT_CONFLICT",
    VALIDATION_ERROR = "VALIDATION_ERROR"
}
export declare const BusinessErrorMessage: Record<BusinessErrorCode, string>;
export declare function createSuccessResponse<T>(data?: T, message?: string): ApiResponse<T>;
export declare function createBusinessErrorResponse<T>(businessCode: BusinessErrorCode, customMessage?: string, data?: T): ApiResponse<T>;
export declare function createErrorResponse<T>(code: string, message: string, businessCode?: BusinessErrorCode, businessMessage?: string, data?: T): ApiResponse<T>;
