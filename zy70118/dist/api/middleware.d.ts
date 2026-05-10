import { Request, Response, NextFunction } from 'express';
export interface ApiError {
    code: string;
    message: string;
    details?: Record<string, unknown>;
}
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: ApiError;
    message?: string;
}
export declare function jsonBodyParser(req: Request, res: Response, next: NextFunction): void;
export declare function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void;
export declare function notFoundHandler(req: Request, res: Response): void;
