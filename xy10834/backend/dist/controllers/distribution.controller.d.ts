import { Request, Response, NextFunction } from 'express';
export declare function publishVersion(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getAllVersions(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getVersions(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getVersionDetail(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function forceRefresh(req: Request, res: Response, next: NextFunction): Promise<void>;
