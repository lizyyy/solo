import { Request, Response } from 'express';
export declare class SubmissionController {
    static createSubmission(req: Request, res: Response): void;
    static getSubmission(req: Request, res: Response): Response<any, Record<string, any>> | undefined;
    static getSubmissions(req: Request, res: Response): void;
    static processSubmission(req: Request, res: Response): Promise<void>;
    static previewBatchAction(req: Request, res: Response): void;
    static processBatch(req: Request, res: Response): Promise<void>;
    static updateSubmissionField(req: Request, res: Response): Response<any, Record<string, any>> | undefined;
    static getBatchStats(req: Request, res: Response): void;
    static getAllBatches(req: Request, res: Response): void;
}
