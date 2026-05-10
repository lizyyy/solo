import { Request, Response, NextFunction } from 'express';
export declare const budgetController: {
    getOrCreate: (req: Request, res: Response, next: NextFunction) => void;
    deductFromBudget: (req: Request, res: Response, next: NextFunction) => void;
    getStatus: (req: Request, res: Response, next: NextFunction) => void;
    list: (req: Request, res: Response, next: NextFunction) => void;
};
