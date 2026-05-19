import { Request, Response, NextFunction } from 'express';
export declare function reportPullResult(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getPullRecords(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getFailedRecords(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function retryFailed(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function detectOldValues(req: Request, res: Response, next: NextFunction): Promise<void>;
