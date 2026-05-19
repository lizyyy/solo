import { Router, Request, Response } from 'express';
import { AuditModel } from '../models/audit.model';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const filters = {
      operationType: req.query.operationType as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined
    };

    const logs = AuditModel.getAll(filters);
    res.json({ success: true, data: logs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/record/:type/:id', (req: Request, res: Response) => {
  try {
    const logs = AuditModel.getByRecord(req.params.type, parseInt(req.params.id));
    res.json({ success: true, data: logs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
