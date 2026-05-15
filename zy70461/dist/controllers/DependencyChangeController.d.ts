import { Request, Response } from 'express';
export declare class DependencyChangeController {
    static createChange(req: Request, res: Response): void;
    static getChange(req: Request, res: Response): Response<any, Record<string, any>> | undefined;
    static getAllChanges(req: Request, res: Response): void;
    static approveChange(req: Request, res: Response): Response<any, Record<string, any>> | undefined;
    static rejectChange(req: Request, res: Response): Response<any, Record<string, any>> | undefined;
}
