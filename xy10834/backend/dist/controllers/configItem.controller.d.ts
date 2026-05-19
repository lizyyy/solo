import { Request, Response, NextFunction } from 'express';
export declare function createConfigItem(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getConfigItems(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getConfigItem(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function updateConfigItem(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function deleteConfigItem(req: Request, res: Response, next: NextFunction): Promise<void>;
