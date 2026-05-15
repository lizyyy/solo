import { Request, Response } from 'express';
export declare class RuleController {
    static createRule(req: Request, res: Response): void;
    static getRule(req: Request, res: Response): Response<any, Record<string, any>> | undefined;
    static getActiveRule(req: Request, res: Response): void;
    static getAllRules(req: Request, res: Response): void;
    static getRuleByDate(req: Request, res: Response): void;
}
