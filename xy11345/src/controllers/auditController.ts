import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { auditService } from '../services/AuditService';

export async function getAuditLogs(req: AuthRequest, res: Response) {
  try {
    const requestId = req.headers['x-request-id'] as string;
    const {
      action,
      entityType,
      batchNumber,
      operator,
      startDate,
      endDate,
      page = 1,
      pageSize = 20,
    } = req.query;

    const filters: any = {
      action: action as any,
      entityType: entityType as string,
      batchNumber: batchNumber as string,
      operator: operator as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      page: Number(page),
      pageSize: Number(pageSize),
    };

    const result = await auditService.getLogs(filters);

    res.json({
      success: true,
      data: result,
      timestamp: Date.now(),
      requestId,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
      timestamp: Date.now(),
      requestId: req.headers['x-request-id'],
    });
  }
}
