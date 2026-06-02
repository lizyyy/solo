import type { Request, Response } from 'express';
import { mergeService } from '../services/mergeService';

export class MergeController {
  getCandidates(req: Request, res: Response) {
    const candidates = mergeService.findMergeCandidates();
    res.json(candidates);
  }

  autoMerge(req: Request, res: Response) {
    const result = mergeService.autoMerge();
    res.json(result);
  }

  manualMerge(req: Request, res: Response) {
    try {
      const result = mergeService.mergeRecords(req.body);
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : '合并失败';
      res.status(400).json({ error: message });
    }
  }

  getConflicts(req: Request, res: Response) {
    const conflicts = mergeService.getConflictsWithHumanMessage();
    res.json(conflicts);
  }
}

export const mergeController = new MergeController();
