import { Request, Response } from 'express';
export declare class WhitelistController {
    create(req: Request, res: Response): Promise<void>;
    findAll(req: Request, res: Response): Promise<void>;
    findById(req: Request, res: Response): Promise<void>;
    update(req: Request, res: Response): Promise<void>;
    approve(req: Request, res: Response): Promise<void>;
    reject(req: Request, res: Response): Promise<void>;
    revoke(req: Request, res: Response): Promise<void>;
    resubmit(req: Request, res: Response): Promise<void>;
    getHistories(req: Request, res: Response): Promise<void>;
    checkWhitelist(req: Request, res: Response): Promise<void>;
    bulkImport(req: Request, res: Response): Promise<void>;
    export(req: Request, res: Response): Promise<void>;
    refreshStatuses(req: Request, res: Response): Promise<void>;
}
export declare const whitelistController: WhitelistController;
