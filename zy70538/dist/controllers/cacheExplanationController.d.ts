import { Request, Response } from 'express';
export declare class CacheExplanationController {
    createExplanation(req: Request, res: Response): Promise<void>;
    getExplanationById(req: Request, res: Response): Promise<void>;
    getExplanationByCacheKey(req: Request, res: Response): Promise<void>;
    queryExplanations(req: Request, res: Response): Promise<void>;
    updateStatus(req: Request, res: Response): Promise<void>;
    manualCorrection(req: Request, res: Response): Promise<void>;
    recordHit(req: Request, res: Response): Promise<void>;
    forceRefresh(req: Request, res: Response): Promise<void>;
    recordFailure(req: Request, res: Response): Promise<void>;
    getDetailedReport(req: Request, res: Response): Promise<void>;
    exportToCSV(req: Request, res: Response): Promise<void>;
    exportToJSON(req: Request, res: Response): Promise<void>;
    getHitHistory(req: Request, res: Response): Promise<void>;
}
export declare const cacheExplanationController: CacheExplanationController;
