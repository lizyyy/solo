import { Router, Request, Response } from 'express';
import { getState } from '../data/store';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const { history } = getState();
  const limit = parseInt(req.query.limit as string) || 100;
  res.json({ 
    success: true, 
    data: history.slice(0, limit) 
  });
});

router.get('/entity/:type/:id', (req: Request, res: Response) => {
  const { history } = getState();
  const { type, id } = req.params;
  
  const entityHistory = history.filter(
    h => h.entityType === type && h.entityId === id
  );
  
  res.json({ success: true, data: entityHistory });
});

export default router;
