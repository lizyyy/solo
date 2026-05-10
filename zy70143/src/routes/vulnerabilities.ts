import { Router, Request, Response } from 'express';
import { AppDataSource } from '../database';
import { Vulnerability } from '../entities/Vulnerability';
import { Assignment } from '../entities/Assignment';
import { StatusLog } from '../entities/StatusLog';
import { VulnerabilityService } from '../services/VulnerabilityService';
import { VulnerabilityStatus } from '../types';
import { createAuditLogger } from '../logger';

const logger = createAuditLogger('VulnerabilityRoutes');

export function vulnerabilityRouter(): Router {
  const router = Router();

  const getService = (): VulnerabilityService => {
    return new VulnerabilityService(
      AppDataSource.getRepository(Vulnerability),
      AppDataSource.getRepository(Assignment),
      AppDataSource.getRepository(StatusLog)
    );
  };

  router.post('/', async (req: Request, res: Response) => {
    try {
      const service = getService();
      const vulnerability = await service.createVulnerability(req.body);
      logger.info('API: 创建漏洞成功', { vulnerabilityId: vulnerability.id });
      res.status(201).json({
        success: true,
        data: vulnerability
      });
    } catch (error: any) {
      logger.error('API: 创建漏洞失败', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  router.get('/', async (req: Request, res: Response) => {
    try {
      const service = getService();
      const filters = {
        status: req.query.status as VulnerabilityStatus | undefined,
        severity: req.query.severity as string | undefined,
        assigneeId: req.query.assigneeId as string | undefined,
        batchId: req.query.batchId as string | undefined
      };
      const vulnerabilities = await service.listVulnerabilities(filters);
      res.json({
        success: true,
        data: vulnerabilities
      });
    } catch (error: any) {
      logger.error('API: 查询漏洞失败', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  router.get('/statistics', async (req: Request, res: Response) => {
    try {
      const service = getService();
      const stats = await service.getStatistics();
      res.json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      logger.error('API: 获取统计数据失败', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const service = getService();
      const vulnerability = await service.getVulnerability(req.params.id);
      if (!vulnerability) {
        res.status(404).json({
          success: false,
          error: '漏洞不存在'
        });
        return;
      }
      res.json({
        success: true,
        data: vulnerability
      });
    } catch (error: any) {
      logger.error('API: 查询漏洞详情失败', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  router.post('/:id/assign', async (req: Request, res: Response) => {
    try {
      const service = getService();
      const { assigneeId, assigneeName, assignmentNote, operatorId, operatorName, isManualOverride } = req.body;
      const result = await service.assignVulnerability(
        req.params.id,
        assigneeId,
        assigneeName,
        assignmentNote || `由 ${operatorName} 分配`,
        operatorId,
        operatorName,
        isManualOverride || false
      );
      logger.info('API: 分配漏洞负责人成功', { vulnerabilityId: req.params.id, assigneeId });
      res.json({
        success: true,
        data: result.vulnerability,
        assignment: result.assignment,
        warnings: result.warnings
      });
    } catch (error: any) {
      logger.error('API: 分配漏洞负责人失败', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  router.post('/:id/status', async (req: Request, res: Response) => {
    try {
      const service = getService();
      const { newStatus, reason, operatorId, operatorName, isManualOverride } = req.body;
      const result = await service.changeStatus(
        req.params.id,
        newStatus,
        reason,
        operatorId,
        operatorName,
        isManualOverride || false
      );
      logger.info('API: 变更漏洞状态成功', { vulnerabilityId: req.params.id, newStatus });
      res.json({
        success: true,
        data: result.vulnerability,
        statusLog: result.statusLog,
        warnings: result.warnings
      });
    } catch (error: any) {
      logger.error('API: 变更漏洞状态失败', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  router.get('/:id/history', async (req: Request, res: Response) => {
    try {
      const service = getService();
      const history = await service.getStatusHistory(req.params.id);
      res.json({
        success: true,
        data: history
      });
    } catch (error: any) {
      logger.error('API: 获取状态历史失败', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  router.get('/:id/assignments', async (req: Request, res: Response) => {
    try {
      const service = getService();
      const assignments = await service.getAssignments(req.params.id);
      res.json({
        success: true,
        data: assignments
      });
    } catch (error: any) {
      logger.error('API: 获取分配历史失败', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}
