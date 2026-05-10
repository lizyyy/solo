import { Router, Request, Response } from 'express';
import { auditService } from '../services/auditService';
import { userService } from '../services/userService';
import { collectionService } from '../services/collectionService';
import { FreezeType } from '../types';

const router = Router();

router.post('/freeze/user', (req: Request, res: Response) => {
  try {
    const { userId, reason, adminId } = req.body;
    if (!userId || !reason || !adminId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    userService.freezeUser(userId);
    const freeze = auditService.freezeTarget(FreezeType.USER, userId, reason, adminId);
    res.json(freeze);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/unfreeze/user', (req: Request, res: Response) => {
  try {
    const { userId, adminId } = req.body;
    if (!userId || !adminId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    userService.unfreezeUser(userId);
    const freeze = auditService.unfreezeTarget(FreezeType.USER, userId, adminId);
    res.json(freeze);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/freeze/collection', (req: Request, res: Response) => {
  try {
    const { collectionId, reason, adminId } = req.body;
    if (!collectionId || !reason || !adminId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    collectionService.freezeCollection(collectionId);
    const freeze = auditService.freezeTarget(FreezeType.COLLECTION, collectionId, reason, adminId);
    res.json(freeze);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/unfreeze/collection', (req: Request, res: Response) => {
  try {
    const { collectionId, adminId } = req.body;
    if (!collectionId || !adminId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    collectionService.unfreezeCollection(collectionId);
    const freeze = auditService.unfreezeTarget(FreezeType.COLLECTION, collectionId, adminId);
    res.json(freeze);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/audit/:targetType/:targetId', (req: Request, res: Response) => {
  const logs = auditService.getAuditLogsByTarget(req.params.targetType, req.params.targetId);
  res.json(logs);
});

router.get('/audit/action/:action', (req: Request, res: Response) => {
  const logs = auditService.getAuditLogsByAction(req.params.action);
  res.json(logs);
});

export default router;
