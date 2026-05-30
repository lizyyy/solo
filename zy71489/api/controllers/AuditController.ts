import { type Request, type Response } from 'express';
import AuditRepo from '../repositories/AuditRepo.js';

const auditRepo = new AuditRepo();

export async function getAuditLogs(req: Request, res: Response): Promise<void> {
  try {
    const { entityType, action, limit } = req.query;
    let logs;

    if (entityType && typeof entityType === 'string') {
      logs = auditRepo.findByEntityType(entityType as 'track' | 'vote' | 'copyright' | 'decision');
    } else if (action && typeof action === 'string') {
      logs = auditRepo.findByAction(action as 'create' | 'update' | 'delete' | 'import' | 'decision' | 'export');
    } else if (limit) {
      logs = auditRepo.findRecent(parseInt(limit as string, 10));
    } else {
      logs = auditRepo.findAll();
    }

    res.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取审计日志失败',
    });
  }
}
