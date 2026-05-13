import express, { Request, Response } from 'express';
import { TreatmentService } from '../services/treatment';
import { ExceptionStatus } from '../types';

export const createExceptionRouter = (treatmentService: TreatmentService) => {
  const router = express.Router();

  router.get('/', async (req: Request, res: Response) => {
    try {
      const { status } = req.query;
      const exceptions = await treatmentService.getAllExceptions(status as ExceptionStatus);
      res.json({ success: true, data: exceptions });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  router.post('/', async (req: Request, res: Response) => {
    try {
      const { operatorId, operatorName, ...exceptionData } = req.body;
      const exception = await treatmentService.createException(
        exceptionData,
        operatorId || 'admin',
        operatorName || '管理员'
      );
      res.json({ success: true, data: exception });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  router.put('/:id/resolve', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { resolution, resolvedBy, resolvedByName, reason } = req.body;
      const exception = await treatmentService.resolveException(
        id,
        resolution,
        resolvedBy || 'admin',
        resolvedByName || '管理员',
        reason
      );
      if (!exception) {
        return res.status(404).json({ success: false, error: 'Exception not found' });
      }
      res.json({ success: true, data: exception });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  return router;
};

export default createExceptionRouter;
