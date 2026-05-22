import { Router, Response } from 'express';
import { authenticateToken, requirePermission, AuthRequest } from '../middleware/auth.js';
import { Role } from '../../shared/types.js';
import { freezeBatch, unfreezeBatch, settleBatch, getFrozenBatches, getFreezeComparison } from '../services/settlementService.js';

const router = Router();

router.use(authenticateToken);

router.get('/frozen', 
  requirePermission('settlement:freeze', Role.PROJECT_MANAGER),
  async (req: AuthRequest, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const result = getFrozenBatches(page, pageSize);
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }
);

router.get('/:id/comparison', 
  requirePermission('settlement:freeze', Role.PROJECT_MANAGER),
  async (req: AuthRequest, res: Response) => {
    try {
      const result = getFreezeComparison(req.params.id);
      if (!result) {
        res.status(404).json({ success: false, error: '批次不存在' });
        return;
      }
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }
);

router.post('/:id/freeze', 
  requirePermission('settlement:freeze', Role.PROJECT_MANAGER),
  async (req: AuthRequest, res: Response) => {
    try {
      const result = freezeBatch(
        req.params.id,
        req.user!.id,
        req.user!.realName,
        req.ip
      );
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  }
);

router.post('/:id/unfreeze', 
  requirePermission('settlement:unfreeze', Role.PROJECT_MANAGER),
  async (req: AuthRequest, res: Response) => {
    try {
      const { reason } = req.body;
      if (!reason) {
        res.status(400).json({ success: false, error: '请填写解冻理由' });
        return;
      }

      const result = unfreezeBatch(
        req.params.id,
        req.user!.id,
        req.user!.realName,
        reason,
        req.ip
      );
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  }
);

router.post('/:id/settle', 
  requirePermission('settlement:settle', Role.FINANCE),
  async (req: AuthRequest, res: Response) => {
    try {
      const result = settleBatch(
        req.params.id,
        req.user!.id,
        req.user!.realName,
        req.ip
      );
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  }
);

export default router;
