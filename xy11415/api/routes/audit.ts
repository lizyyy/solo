import { Router, Response } from 'express';
import { authenticateToken, requirePermission, AuthRequest } from '../middleware/auth.js';
import { Role } from '../../shared/types.js';
import { getAuditLogs } from '../services/auditService.js';

const router = Router();

router.use(authenticateToken);

router.get('/', 
  requirePermission('audit:view', Role.PROJECT_MANAGER),
  async (req: AuthRequest, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const action = req.query.action as string | undefined;
      const success = req.query.success !== undefined ? req.query.success === 'true' : undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      const result = getAuditLogs(page, pageSize, {
        action,
        success,
        startDate,
        endDate
      });

      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }
);

export default router;
