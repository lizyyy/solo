import express, { type Request, type Response } from 'express';
import { AuditService } from '../services/AuditService.js';
import type { OperationType, OpinionSource } from '../../shared/types.js';

const router = express.Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const { materialId, operation, sourceTag, operatorRole } = req.query;
    const logs = AuditService.getAuditLogs({
      materialId: materialId ? parseInt(materialId as string, 10) : undefined,
      operation: operation as OperationType | undefined,
      sourceTag: sourceTag as OpinionSource | undefined,
      operatorRole: operatorRole as 'ENGINEER' | 'PM' | undefined,
    });
    res.json({ success: true, data: logs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
