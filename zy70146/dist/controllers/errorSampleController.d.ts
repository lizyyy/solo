import { Request, Response, NextFunction } from 'express';
export declare const errorSampleController: {
    create: (req: Request, res: Response, next: NextFunction) => void;
    list: (req: Request, res: Response, next: NextFunction) => void;
    getById: (req: Request, res: Response, next: NextFunction) => void;
    getPendingDeductions: (req: Request, res: Response, next: NextFunction) => void;
    batchRecordAndDeduct: (req: Request, res: Response, next: NextFunction) => void;
};
