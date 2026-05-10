import { Request, Response, NextFunction } from 'express';
export declare const freezeController: {
    freeze: (req: Request, res: Response, next: NextFunction) => void;
    unfreeze: (req: Request, res: Response, next: NextFunction) => void;
    list: (req: Request, res: Response, next: NextFunction) => void;
    getActive: (req: Request, res: Response, next: NextFunction) => void;
};
