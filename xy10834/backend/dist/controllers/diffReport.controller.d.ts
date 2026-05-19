import { Request, Response, NextFunction } from 'express';
export declare function generateDiffReport(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getConfigVersions(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getDiffReports(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getDiffReport(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function exportReportToCSV(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function exportEffectiveStatesToCSV(req: Request, res: Response, next: NextFunction): Promise<void>;
