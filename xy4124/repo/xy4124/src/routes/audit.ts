import { Router, Request, Response } from 'express';
import { AuditLogRepository } from '../storage';

const router = Router();
const auditRepo = new AuditLogRepository();

router.get('/', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const start = req.query.start as string;
  const end = req.query.end as string;
  
  let logs;
  if (start && end) {
    logs = auditRepo.findByDateRange(start, end);
  } else {
    logs = auditRepo.findAll(Math.min(limit, 1000));
  }
  
  res.json(logs);
});

router.get('/:id', (req: Request, res: Response) => {
  const log = auditRepo.findById(req.params.id);
  if (!log) {
    return res.status(404).json({ error: 'Audit log not found' });
  }
  res.json(log);
});

router.get('/entity/:entityType/:entityId', (req: Request, res: Response) => {
  const logs = auditRepo.findByEntity(
    req.params.entityType,
    req.params.entityId
  );
  res.json(logs);
});

export { router as auditRouter };
