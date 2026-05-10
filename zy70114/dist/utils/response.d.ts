import { ApiResponse } from '../types';
export declare class BusinessError extends Error {
    code: string;
    businessMessage: string;
    constructor(message: string, businessMessage: string, code?: string);
}
export declare const successResponse: <T>(data?: T, message?: string, businessMessage?: string) => ApiResponse<T>;
export declare const errorResponse: <T = null>(code: string, message: string, businessMessage: string, data?: T) => ApiResponse<T>;
export declare const formatDuration: (ms: number) => string;
export declare const formatTime: (timestamp: number) => string;
export declare const formatCurrency: (amount: number, currency?: string) => string;
