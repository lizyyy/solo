import { Request, Response, NextFunction } from 'express';
export declare const processTraceController: {
    getById: (req: Request, res: Response, next: NextFunction) => void;
    list: (req: Request, res: Response, next: NextFunction) => void;
    getCurrentBlocker: (req: Request, res: Response, next: NextFunction) => void;
    getTraceChain: (req: Request, res: Response, next: NextFunction) => void;
};
