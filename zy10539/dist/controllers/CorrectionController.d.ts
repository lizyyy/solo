import type { Request, Response } from 'express';
export declare class CorrectionController {
    createCorrection(req: Request, res: Response): Promise<void>;
    getCorrection(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    listCorrections(req: Request, res: Response): Promise<void>;
    generatePreview(req: Request, res: Response): Promise<void>;
    submitForApproval(req: Request, res: Response): Promise<void>;
    approveCorrection(req: Request, res: Response): Promise<void>;
    rejectCorrection(req: Request, res: Response): Promise<void>;
    executeCorrection(req: Request, res: Response): Promise<void>;
    rollbackCorrection(req: Request, res: Response): Promise<void>;
    manualFix(req: Request, res: Response): Promise<void>;
    resolveException(req: Request, res: Response): Promise<void>;
    generateReport(req: Request, res: Response): Promise<void>;
    exportReport(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getReport(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
export declare const correctionController: CorrectionController;
