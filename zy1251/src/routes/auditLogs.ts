import { Router, Response } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { authMiddleware, requireRole } from '../middleware/auth';
import { wrapAsync } from '../middleware/error';
import { getAuditLogs } from '../services/auditLogService';

const router = Router();

router.use(authMiddleware);

router.get(
  '/',
  requireRole('admin', 'super_admin'),
  wrapAsync(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const {
      userId,
      action,
      resourceType,
      startTime,
      endTime,
      page = '1',
      pageSize = '20',
    } = req.query;

    const result = await getAuditLogs(req.user!.tenantId, {
      userId: userId as string,
      action: action as string,
      resourceType: resourceType as string,
      startTime: startTime ? new Date(startTime as string) : undefined,
      endTime: endTime ? new Date(endTime as string) : undefined,
      page: parseInt(page as string, 10),
      pageSize: parseInt(pageSize as string, 10),
    });

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  })
);

router.get(
  '/my',
  wrapAsync(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { page = '1', pageSize = '20', startTime, endTime } = req.query;

    const result = await getAuditLogs(req.user!.tenantId, {
      userId: req.user!.id,
      startTime: startTime ? new Date(startTime as string) : undefined,
      endTime: endTime ? new Date(endTime as string) : undefined,
      page: parseInt(page as string, 10),
      pageSize: parseInt(pageSize as string, 10),
    });

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  })
);

export default router;
