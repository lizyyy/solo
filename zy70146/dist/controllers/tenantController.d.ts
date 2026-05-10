import { Request, Response, NextFunction } from 'express';
export declare const tenantController: {
    create: (req: Request, res: Response, next: NextFunction) => void;
    list: (req: Request, res: Response, next: NextFunction) => void;
    getById: (req: Request, res: Response, next: NextFunction) => void;
    update: (req: Request, res: Response, next: NextFunction) => void;
    delete: (req: Request, res: Response, next: NextFunction) => void;
};
