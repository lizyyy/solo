import { Router, Request, Response } from 'express';
import { collectionService } from '../services/collectionService';
import { transferService } from '../services/transferService';
import { auditService } from '../services/auditService';
import { FreezeType } from '../types';

const router = Router();

router.post('/', (req: Request, res: Response) => {
  try {
    const { name, ownerId } = req.body;
    if (!name || !ownerId) {
      return res.status(400).json({ error: '藏品名称和拥有者ID不能为空' });
    }
    const collection = collectionService.createCollection(name, ownerId);
    res.json(collection);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:collectionId', (req: Request, res: Response) => {
  const collection = collectionService.getCollection(req.params.collectionId);
  if (!collection) {
    return res.status(404).json({ error: '藏品不存在' });
  }
  res.json(collection);
});

router.get('/:collectionId/transfers', (req: Request, res: Response) => {
  const transfers = transferService.getTransfersByCollection(req.params.collectionId);
  res.json(transfers);
});

router.get('/:collectionId/freeze-history', (req: Request, res: Response) => {
  const history = auditService.getFreezeHistory(FreezeType.COLLECTION, req.params.collectionId);
  res.json(history);
});

export default router;
