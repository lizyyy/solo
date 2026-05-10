import { Router, Request, Response } from 'express';
import { userService } from '../services/userService';
import { collectionService } from '../services/collectionService';
import { transferService } from '../services/transferService';
import { auditService } from '../services/auditService';
import { FreezeType } from '../types';

const router = Router();

router.post('/', (req: Request, res: Response) => {
  try {
    const { name, isVerified } = req.body;
    if (!name) {
      return res.status(400).json({ error: '用户名不能为空' });
    }
    const user = userService.createUser(name, !!isVerified);
    res.json(user);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:userId', (req: Request, res: Response) => {
  const user = userService.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }
  res.json(user);
});

router.put('/:userId/verify', (req: Request, res: Response) => {
  try {
    const { isVerified } = req.body;
    if (typeof isVerified !== 'boolean') {
      return res.status(400).json({ error: 'isVerified 必须是布尔值' });
    }
    const user = userService.updateVerification(req.params.userId, isVerified);
    res.json(user);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:userId/collections', (req: Request, res: Response) => {
  const collections = collectionService.getCollectionsByOwner(req.params.userId);
  res.json(collections);
});

router.get('/:userId/transfers', (req: Request, res: Response) => {
  const status = req.query.status as any;
  const transfers = transferService.getTransfersByUser(req.params.userId, status);
  res.json(transfers);
});

router.get('/:userId/audit', (req: Request, res: Response) => {
  const logs = auditService.getAuditLogsByActor(req.params.userId);
  res.json(logs);
});

router.get('/:userId/freeze-history', (req: Request, res: Response) => {
  const history = auditService.getFreezeHistory(FreezeType.USER, req.params.userId);
  res.json(history);
});

export default router;
