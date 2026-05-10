import { Request, Response, NextFunction } from 'express';
export declare const alertSuppressionController: {
    suppress: (req: Request, res: Response, next: NextFunction) => void;
    unsuppress: (req: Request, res: Response, next: NextFunction) => void;
    list: (req: Request, res: Response, next: NextFunction) => void;
    checkSuppressed: (req: Request, res: Response, next: NextFunction) => void;
    getActive: (req: Request, res: Response, next: NextFunction) => void;
};
