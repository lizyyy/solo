import { Router, Request, Response } from 'express';
import { AppDataSource } from '../database';
import { RiskItem } from '../entities/RiskItem';
import { Vulnerability } from '../entities/Vulnerability';
import { RiskService } from '../services/RiskService';
import { RiskStatus } from '../entities/RiskItem';
import { createAuditLogger } from '../logger';

const logger = createAuditLogger('RiskRoutes');

export function riskRouter(): Router {
  const router = Router();

  const getService = (): RiskService => {
    return new RiskService(
      AppDataSource.getRepository(RiskItem),
      AppDataSource.getRepository(Vulnerability)
    );
  };

  router.post('/', async (req: Request, res: Response) => {
    try {
      const service = getService();
      const riskItem = await service.createRiskItem({
        ...req.body,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined
      });
      logger.info('API: 创建风险项成功', { riskId: riskItem.id });
      res.status(201).json({
        success: true,
        data: riskItem
      });
    } catch (error: any) {
      logger.error('API: 创建风险项失败', { error: error.message });
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
        status: req.query.status as RiskStatus | undefined,
        level: req.query.level as any,
        vulnerabilityId: req.query.vulnerabilityId as string | undefined,
        ownerId: req.query.ownerId as string | undefined
      };
      const risks = await service.listRiskItems(filters);
      res.json({
        success: true,
        data: risks
      });
    } catch (error: any) {
      logger.error('API: 查询风险项失败', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  router.get('/dashboard', async (req: Request, res: Response) => {
    try {
      const service = getService();
      const dashboard = await service.getRiskDashboard();
      res.json({
        success: true,
        data: dashboard
      });
    } catch (error: any) {
      logger.error('API: 获取风险看板失败', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const service = getService();
      const riskItem = await service.getRiskItem(req.params.id);
      if (!riskItem) {
        res.status(404).json({
          success: false,
          error: '风险项不存在'
        });
        return;
      }
      res.json({
        success: true,
        data: riskItem
      });
    } catch (error: any) {
      logger.error('API: 查询风险项详情失败', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  router.post('/:id/status', async (req: Request, res: Response) => {
    try {
      const service = getService();
      const { newStatus, resolutionNote, operatorId, operatorName } = req.body;
      const riskItem = await service.updateRiskStatus(
        req.params.id,
        newStatus,
        resolutionNote,
        operatorId,
        operatorName
      );
      logger.info('API: 更新风险项状态成功', { riskId: req.params.id, newStatus });
      res.json({
        success: true,
        data: riskItem
      });
    } catch (error: any) {
      logger.error('API: 更新风险项状态失败', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}
