import { Router, Response } from 'express';
import { AuthRequest, requireRole } from '../middleware/auth';
import { PreparationService } from '../services/preparation';
import { UserRole } from '../types';

export function createFailedRouter(service: PreparationService): Router {
  const router = Router();

  router.use(requireRole(UserRole.ADMIN, UserRole.AUDITOR));

  router.get('/', async (req: AuthRequest, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100);
    const resolved = req.query.resolved !== undefined 
      ? req.query.resolved === 'true' 
      : undefined;

    const result = await service.getFailedRecords({ page, pageSize, resolved });

    res.json({
      success: true,
      data: result,
      timestamp: Date.now()
    });
  });

  router.post('/:id/resolve', async (req: AuthRequest, res: Response) => {
    const { resolutionNote } = req.body;
    if (!resolutionNote) {
      return res.status(400).json({
        success: false,
        message: '请提供处理说明',
        timestamp: Date.now()
      });
    }

    const success = await service.resolveFailedRecord(
      req.params.id,
      resolutionNote,
      req.user!.id
    );

    if (!success) {
      return res.status(404).json({
        success: false,
        message: '记录不存在',
        timestamp: Date.now()
      });
    }

    res.json({
      success: true,
      message: '已标记为已处理',
      timestamp: Date.now()
    });
  });

  return router;
}
