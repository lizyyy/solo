import { Router, Request, Response } from 'express';
import { db } from '../database';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const { entityType, entityId } = req.query;
  const histories = db.getStatusHistory(
    entityType as any,
    entityId as string
  );
  res.success(histories);
});

export default router;
