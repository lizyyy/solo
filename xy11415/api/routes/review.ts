import { Router, Response } from 'express';
import { authenticateToken, requirePermission, AuthRequest } from '../middleware/auth.js';
import { Role } from '../../shared/types.js';
import { reviewBatch, getPendingReviewBatches } from '../services/reviewService.js';

const router = Router();

router.use(authenticateToken);

router.get('/pending', 
  requirePermission('review:approve', Role.REVIEWER),
  async (req: AuthRequest, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const result = getPendingReviewBatches(page, pageSize);
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }
);

router.post('/:id/approve', 
  requirePermission('review:approve', Role.REVIEWER),
  async (req: AuthRequest, res: Response) => {
    try {
      const { reason, evidenceAttachments } = req.body;
      if (!reason) {
        res.status(400).json({ success: false, error: '请填写复核通过理由' });
        return;
      }

      const result = reviewBatch(
        req.params.id,
        'approve',
        reason,
        req.user!.id,
        req.user!.realName,
        evidenceAttachments,
        req.ip
      );
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  }
);

router.post('/:id/reject', 
  requirePermission('review:reject', Role.REVIEWER),
  async (req: AuthRequest, res: Response) => {
    try {
      const { reason, evidenceAttachments } = req.body;
      if (!reason) {
        res.status(400).json({ success: false, error: '请填写复核驳回理由' });
        return;
      }

      const result = reviewBatch(
        req.params.id,
        'reject',
        reason,
        req.user!.id,
        req.user!.realName,
        evidenceAttachments,
        req.ip
      );
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  }
);

export default router;
