import { Router, Request, Response } from 'express';
import { AppDataSource } from '../database';
import { DelayRequest } from '../entities/DelayRequest';
import { RiskItem } from '../entities/RiskItem';
import { Vulnerability } from '../entities/Vulnerability';
import { DelayService } from '../services/DelayService';
import { DelayRequestStatus } from '../entities/DelayRequest';
import { createAuditLogger } from '../logger';

const logger = createAuditLogger('DelayRoutes');

export function delayRouter(): Router {
  const router = Router();

  const getService = (): DelayService => {
    return new DelayService(
      AppDataSource.getRepository(DelayRequest),
      AppDataSource.getRepository(RiskItem),
      AppDataSource.getRepository(Vulnerability)
    );
  };

  router.post('/', async (req: Request, res: Response) => {
    try {
      const service = getService();
      const {
        vulnerabilityId,
        requesterId,
        requesterName,
        newDueDate,
        reason,
        riskMitigation,
        isManualOverride
      } = req.body;

      const result = await service.createDelayRequest(
        vulnerabilityId,
        requesterId,
        requesterName,
        new Date(newDueDate),
        reason,
        riskMitigation,
        isManualOverride || false
      );

      logger.info('API: 创建延期申请成功', {
        requestId: result.request.id
      });

      res.status(201).json({
        success: true,
        data: result.request,
        warnings: result.warnings,
        additionalRisk: result.additionalRisk
      });
    } catch (error: any) {
      logger.error('API: 创建延期申请失败', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  router.get('/', async (req: Request, res: Response) => {
    try {
      const service = getService();
      const requests = await service.getDelayRequests(
        req.query.vulnerabilityId as string | undefined,
        req.query.status as DelayRequestStatus | undefined
      );
      res.json({
        success: true,
        data: requests
      });
    } catch (error: any) {
      logger.error('API: 查询延期申请失败', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  router.post('/:id/approve', async (req: Request, res: Response) => {
    try {
      const service = getService();
      const { approverId, approverName, comment } = req.body;
      const request = await service.approveDelayRequest(
        req.params.id,
        approverId,
        approverName,
        comment
      );

      logger.info('API: 审批延期申请成功', { requestId: req.params.id });

      res.json({
        success: true,
        data: request
      });
    } catch (error: any) {
      logger.error('API: 审批延期申请失败', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  router.post('/:id/reject', async (req: Request, res: Response) => {
    try {
      const service = getService();
      const { approverId, approverName, comment } = req.body;
      const request = await service.rejectDelayRequest(
        req.params.id,
        approverId,
        approverName,
        comment
      );

      logger.info('API: 拒绝延期申请成功', { requestId: req.params.id });

      res.json({
        success: true,
        data: request
      });
    } catch (error: any) {
      logger.error('API: 拒绝延期申请失败', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}
