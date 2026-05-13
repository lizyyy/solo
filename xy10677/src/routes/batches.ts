import express, { Request, Response } from 'express';
import { TreatmentService } from '../services/treatment';
import { DatabaseService } from '../services/database';
import { AlignerStatus } from '../types';

export const createBatchRouter = (
  treatmentService: TreatmentService,
  dbService: DatabaseService
) => {
  const router = express.Router();

  router.post('/', async (req: Request, res: Response) => {
    try {
      const idempotentResult = await dbService.checkIdempotency(req.body);
      if (idempotentResult) {
        return res.json(idempotentResult);
      }

      const { operatorId, operatorName, ...batchData } = req.body;
      const batch = await treatmentService.createAlignerBatch(
        batchData,
        operatorId || 'admin',
        operatorName || '管理员'
      );

      const result = { success: true, data: batch };
      await dbService.saveIdempotency(req.body, result);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  router.post('/batch-import', async (req: Request, res: Response) => {
    try {
      const { batches, operatorId, operatorName } = req.body;
      const results = await treatmentService.batchImportBatches(
        batches,
        operatorId || 'admin',
        operatorName || '管理员'
      );
      res.json({ success: true, data: results });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  router.put('/:id/status', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { newStatus, actualEndDate, operatorId, operatorName, reason } = req.body;
      const batch = await treatmentService.advanceAlignerBatch(
        id,
        newStatus as AlignerStatus,
        actualEndDate,
        operatorId || 'admin',
        operatorName || '管理员',
        reason
      );
      if (!batch) {
        return res.status(404).json({ success: false, error: 'Batch not found' });
      }
      res.json({ success: true, data: batch });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  return router;
};

export default createBatchRouter;
