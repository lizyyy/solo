import { Request, Response } from 'express';
export declare class ReportController {
    static generateBatchReport(req: Request, res: Response): Promise<void>;
    static getReport(req: Request, res: Response): Response<any, Record<string, any>> | undefined;
    static getReportsByBatch(req: Request, res: Response): void;
    static getAllReports(req: Request, res: Response): void;
}
