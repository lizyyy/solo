import { Request, Response } from 'express';
import { selfCheckService } from '../services/SelfCheckService';

export class SelfCheckController {
  async runSelfCheck(req: Request, res: Response) {
    try {
      const result = selfCheckService.runSelfCheck();
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }
}

export const selfCheckController = new SelfCheckController();
