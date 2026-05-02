import { Router, Request, Response } from 'express';
import { getAuditLogs } from '../storage';
import { AuditLog, AuditLogFilter, ApiResponse } from '../types';

const router = Router();

router.get('/', (req: Request, res: Response<ApiResponse<AuditLog[]>>) => {
  try {
    const filter: AuditLogFilter = {};

    if (req.query.entityType) {
      filter.entityType = req.query.entityType as any;
    }
    if (req.query.entityId) {
      filter.entityId = req.query.entityId as string;
    }
    if (req.query.action) {
      filter.action = req.query.action as string;
    }
    if (req.query.operator) {
      filter.operator = req.query.operator as string;
    }
    if (req.query.startDate) {
      filter.startDate = req.query.startDate as string;
    }
    if (req.query.endDate) {
      filter.endDate = req.query.endDate as string;
    }

    const logs = getAuditLogs(filter);
    res.json({
      success: true,
      data: logs,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取审计日志失败',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
