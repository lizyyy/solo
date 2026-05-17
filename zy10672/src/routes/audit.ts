import { Router, Request, Response } from 'express';
import { AuditService } from '../services/auditService';
import { ApiResponse, ApprovalAction } from '../types';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const action = req.query.action as ApprovalAction | undefined;
  const operatorId = req.query.operatorId as string | undefined;
  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

  const result = await AuditService.listAuditLogs(page, pageSize, {
    action,
    operatorId,
    startDate,
    endDate
  });

  const response: ApiResponse = {
    success: true,
    data: result
  };
  res.json(response);
});

export default router;
