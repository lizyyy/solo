import { Request, Response, NextFunction } from 'express';
export declare function createServiceInstance(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getServiceInstances(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getServiceInstance(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function heartbeat(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function updateInstanceStatus(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function deleteServiceInstance(req: Request, res: Response, next: NextFunction): Promise<void>;
