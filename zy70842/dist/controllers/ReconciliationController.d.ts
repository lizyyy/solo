import { Request, Response } from 'express';
declare class ReconciliationController {
    createReconciliation(req: Request, res: Response): Promise<void>;
    batchCreateReconciliations(req: Request, res: Response): Promise<void>;
    getReconciliation(req: Request, res: Response): Promise<void>;
    getAllReconciliations(req: Request, res: Response): Promise<void>;
    reviewDiscrepancy(req: Request, res: Response): Promise<void>;
    completeReconciliation(req: Request, res: Response): Promise<void>;
    getSummary(req: Request, res: Response): Promise<void>;
    importApplications(req: Request, res: Response): Promise<void>;
    importLicenses(req: Request, res: Response): Promise<void>;
    importVenueCalendar(req: Request, res: Response): Promise<void>;
    exportReconciliationCSV(req: Request, res: Response): Promise<void>;
    exportReconciliationPDF(req: Request, res: Response): Promise<void>;
    exportSummaryCSV(req: Request, res: Response): Promise<void>;
    exportSummaryPDF(req: Request, res: Response): Promise<void>;
    getAllApplications(req: Request, res: Response): Promise<void>;
    getAllLicenses(req: Request, res: Response): Promise<void>;
    getVenueCalendar(req: Request, res: Response): Promise<void>;
}
export declare const reconciliationController: ReconciliationController;
export {};
