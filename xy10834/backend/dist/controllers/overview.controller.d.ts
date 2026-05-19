import { Request, Response, NextFunction } from 'express';
export declare function getStatistics(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getRecentActivity(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getFailedDetails(req: Request, res: Response, next: NextFunction): Promise<void>;
