import { Request, Response } from 'express';
export declare class ReconciliationController {
    importBedCSV(req: Request, res: Response): Promise<void>;
    importPatientJSON(req: Request, res: Response): Promise<void>;
    importCleaningWorkOrdersJSON(req: Request, res: Response): Promise<void>;
    runReconciliation(req: Request, res: Response): Promise<void>;
    reviewDiscrepancy(req: Request, res: Response): Promise<void>;
    batchReview(req: Request, res: Response): Promise<void>;
    getDiscrepancies(req: Request, res: Response): Promise<void>;
    getDiscrepancy(req: Request, res: Response): Promise<void>;
    getPatientAuditTrail(req: Request, res: Response): Promise<void>;
    getPatientFullReport(req: Request, res: Response): Promise<void>;
    generateReconciliationReport(req: Request, res: Response): Promise<void>;
    exportDiscrepanciesCSV(req: Request, res: Response): Promise<void>;
    exportBedsCSV(req: Request, res: Response): Promise<void>;
    exportPatientsCSV(req: Request, res: Response): Promise<void>;
    exportWorkOrdersCSV(req: Request, res: Response): Promise<void>;
    getSummaryStatistics(req: Request, res: Response): Promise<void>;
    getDashboardData(req: Request, res: Response): Promise<void>;
    getBeds(req: Request, res: Response): Promise<void>;
    getPatients(req: Request, res: Response): Promise<void>;
    getWorkOrders(req: Request, res: Response): Promise<void>;
    getReconciliationRecords(req: Request, res: Response): Promise<void>;
    validateConsistency(req: Request, res: Response): Promise<void>;
    clearAllData(req: Request, res: Response): Promise<void>;
}
export declare const reconciliationController: ReconciliationController;
