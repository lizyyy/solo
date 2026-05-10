import { Request, Response, NextFunction } from 'express';
export declare const reportController: {
    generateBudgetReport: (req: Request, res: Response, next: NextFunction) => void;
    getErrorTrend: (req: Request, res: Response, next: NextFunction) => void;
    getSLOCompliance: (req: Request, res: Response, next: NextFunction) => void;
    getProcessBlockers: (req: Request, res: Response, next: NextFunction) => void;
};
