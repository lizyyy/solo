import { Router, Request, Response } from 'express';
import { Database } from '../database';
import { createBatch, getBatches, getBatchDetail } from '../services/materialService';

export function createBatchRouter(db: Database): Router {
  const router = Router();

  router.post('/', async (req: Request, res: Response) => {
    try {
      const { name, createdBy } = req.body;
      
      if (!name || !createdBy) {
        return res.status(400).json({ error: '批次名称和创建人不能为空' });
      }

      const batch = await createBatch(db, name, createdBy);
      res.json(batch);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/', async (req: Request, res: Response) => {
    try {
      const batches = await getBatches(db);
      res.json(batches);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const detail = await getBatchDetail(db, id);
      
      if (!detail) {
        return res.status(404).json({ error: '批次不存在' });
      }
      
      res.json(detail);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
