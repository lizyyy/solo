import { Router, Request, Response } from 'express';
import { AppDataSource } from '../database';
import { Batch } from '../entities/Batch';
import { Vulnerability } from '../entities/Vulnerability';
import { UpgradeTask } from '../entities/UpgradeTask';
import { BatchService } from '../services/BatchService';
import { BatchStatus } from '../types';
import { TaskStatus } from '../entities/UpgradeTask';
import { createAuditLogger } from '../logger';

const logger = createAuditLogger('BatchRoutes');

export function batchRouter(): Router {
  const router = Router();

  const getService = (): BatchService => {
    return new BatchService(
      AppDataSource.getRepository(Batch),
      AppDataSource.getRepository(Vulnerability),
      AppDataSource.getRepository(UpgradeTask)
    );
  };

  router.post('/', async (req: Request, res: Response) => {
    try {
      const service = getService();
      const batch = await service.createBatch({
        ...req.body,
        plannedDate: new Date(req.body.plannedDate)
      });
      logger.info('API: 创建批次成功', { batchId: batch.id });
      res.status(201).json({
        success: true,
        data: batch
      });
    } catch (error: any) {
      logger.error('API: 创建批次失败', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  router.get('/', async (req: Request, res: Response) => {
    try {
      const service = getService();
      const batches = await service.listBatches(
        req.query.status as BatchStatus | undefined
      );
      res.json({
        success: true,
        data: batches
      });
    } catch (error: any) {
      logger.error('API: 查询批次失败', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const service = getService();
      const batch = await service.getBatch(req.params.id);
      if (!batch) {
        res.status(404).json({
          success: false,
          error: '批次不存在'
        });
        return;
      }
      res.json({
        success: true,
        data: batch
      });
    } catch (error: any) {
      logger.error('API: 查询批次详情失败', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  router.post('/:id/add-vulnerability', async (req: Request, res: Response) => {
    try {
      const service = getService();
      const { vulnerabilityId } = req.body;
      await service.addVulnerabilityToBatch(req.params.id, vulnerabilityId);
      logger.info('API: 漏洞加入批次成功', { batchId: req.params.id, vulnerabilityId });
      res.json({
        success: true,
        message: '漏洞已成功加入批次'
      });
    } catch (error: any) {
      logger.error('API: 漏洞加入批次失败', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  router.get('/:id/vulnerabilities', async (req: Request, res: Response) => {
    try {
      const service = getService();
      const vulnerabilities = await service.getBatchVulnerabilities(req.params.id);
      res.json({
        success: true,
        data: vulnerabilities
      });
    } catch (error: any) {
      logger.error('API: 查询批次漏洞失败', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  router.get('/:id/health', async (req: Request, res: Response) => {
    try {
      const service = getService();
      const health = await service.checkBatchHealth(req.params.id);
      res.json({
        success: true,
        data: health
      });
    } catch (error: any) {
      logger.error('API: 查询批次健康状态失败', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  router.post('/:id/deploy', async (req: Request, res: Response) => {
    try {
      const service = getService();
      const batch = await service.deployBatch(
        req.params.id,
        req.body.deployedAt ? new Date(req.body.deployedAt) : undefined
      );
      logger.info('API: 批次上线成功', { batchId: req.params.id });
      res.json({
        success: true,
        data: batch
      });
    } catch (error: any) {
      logger.error('API: 批次上线失败', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  router.post('/tasks', async (req: Request, res: Response) => {
    try {
      const service = getService();
      const task = await service.createUpgradeTask(req.body);
      logger.info('API: 创建升级任务成功', { taskId: task.id });
      res.status(201).json({
        success: true,
        data: task
      });
    } catch (error: any) {
      logger.error('API: 创建升级任务失败', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  router.get('/tasks', async (req: Request, res: Response) => {
    try {
      const service = getService();
      const tasks = await service.getUpgradeTasks(
        req.query.vulnerabilityId as string | undefined,
        req.query.status as TaskStatus | undefined
      );
      res.json({
        success: true,
        data: tasks
      });
    } catch (error: any) {
      logger.error('API: 查询升级任务失败', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  router.post('/tasks/:id/complete', async (req: Request, res: Response) => {
    try {
      const service = getService();
      const task = await service.completeUpgradeTask(req.params.id, req.body.notes);
      logger.info('API: 完成升级任务成功', { taskId: req.params.id });
      res.json({
        success: true,
        data: task
      });
    } catch (error: any) {
      logger.error('API: 完成升级任务失败', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}
