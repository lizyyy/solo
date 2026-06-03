import { Request, Response } from 'express';
import AuditRepository from '../repositories/AuditRepository';

class AuditController {
  async getAllAuditLogs(req: Request, res: Response) {
    try {
      const logs = AuditRepository.findAll();
      
      res.json({
        success: true,
        data: logs
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '获取审计日志失败'
      });
    }
  }

  async getAuditLogsByRecordId(req: Request, res: Response) {
    try {
      const { recordId } = req.params;
      const logs = AuditRepository.findByRecordId(recordId);
      
      res.json({
        success: true,
        data: logs,
        summary: {
          totalChanges: logs.length,
          modifyCount: logs.filter(l => l.action === 'modify').length,
          adjustCount: logs.filter(l => l.action === 'adjust').length,
          reviewCount: logs.filter(l => l.action === 'review').length
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '获取审计日志失败'
      });
    }
  }
}

export default new AuditController();
