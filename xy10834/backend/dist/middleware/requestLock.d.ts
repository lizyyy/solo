import { Request, Response, NextFunction } from 'express';
export declare function generateRequestKey(req: Request): string;
export declare function requestLockMiddleware(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
