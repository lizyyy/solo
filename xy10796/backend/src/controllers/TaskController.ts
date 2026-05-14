import { Request, Response } from 'express';
import { SeedTask, Environment, DatasetVersion, SeedRecord, RollbackRecord } from '../models';
import { StateMachineService } from '../services/StateMachineService';
import { IdempotencyService } from '../services/IdempotencyService';
import { ReportService } from '../services/ReportService';
import { TaskStatus } from '../models/SeedTask';
import { RollbackStatus } from '../models/RollbackRecord';
import { Op } from 'sequelize';

export class TaskController {
  static async createTask(req: Request, res: Response): Promise<void> {
    try {
      const { environmentId, datasetVersionId, requestId, maxRetries = 3 } = req.body;

      if (!environmentId || !datasetVersionId) {
        res.status(400).json({ error: 'environmentId and datasetVersionId are required' });
        return;
      }

      const idempotencyKey = IdempotencyService.generateKey({
        environmentId,
        datasetVersionId,
        requestId,
      });

      const { exists, task } = await IdempotencyService.checkAndLock(idempotencyKey);
      if (exists) {
        res.status(200).json({
          message: 'Duplicate request detected, returning existing task',
          isDuplicate: true,
          task,
        });
        return;
      }

      const environment = await Environment.findByPk(environmentId);
      const dataset = await DatasetVersion.findByPk(datasetVersionId);
      
      if (!environment || !dataset) {
        res.status(404).json({ error: 'Environment or DatasetVersion not found' });
        return;
      }

      const task = await SeedTask.create({
        environmentId,
        datasetVersionId,
        idempotencyKey,
        maxRetries,
        importOrder: dataset.importOrder,
        status: TaskStatus.PENDING,
      });

      setTimeout(() => StateMachineService.processTask(task.id), 100);

      res.status(201).json({
        message: 'Task created successfully',
        isDuplicate: false,
        task,
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async getTasks(req: Request, res: Response): Promise<void> {
    try {
      const {
        status,
        environmentId,
        datasetVersionId,
        page = 1,
        limit = 20,
        startDate,
        endDate,
      } = req.query;

      const where: any = {};
      if (status) where.status = status;
      if (environmentId) where.environmentId = environmentId;
      if (datasetVersionId) where.datasetVersionId = datasetVersionId;
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt[Op.gte] = new Date(startDate as string);
        if (endDate) where.createdAt[Op.lte] = new Date(endDate as string);
      }

      const { count, rows } = await SeedTask.findAndCountAll({
        where,
        include: [Environment, DatasetVersion],
        order: [['createdAt', 'DESC']],
        limit: Number(limit),
        offset: (Number(page) - 1) * Number(limit),
      });

      res.json({
        tasks: rows,
        total: count,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(count / Number(limit)),
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async getTaskById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const task = await SeedTask.findByPk(id, {
        include: [Environment, DatasetVersion],
      });

      if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      const records = await SeedRecord.findAll({ where: { taskId: id } });
      const rollbacks = await RollbackRecord.findAll({ where: { taskId: id } });

      res.json({ task, records, rollbacks });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async retryTask(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await StateMachineService.retryTask(id);
      res.json({ message: 'Task retry initiated' });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  static async rollbackTask(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason) {
        res.status(400).json({ error: 'Rollback reason is required' });
        return;
      }

      await StateMachineService.rollbackTask(id, reason);
      res.json({ message: 'Task rollback initiated' });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  static async reviewRollback(req: Request, res: Response): Promise<void> {
    try {
      const { rollbackId } = req.params;
      const { reviewedBy, reviewComment } = req.body;

      const rollback = await RollbackRecord.findByPk(rollbackId);
      if (!rollback) {
        res.status(404).json({ error: 'Rollback record not found' });
        return;
      }

      await rollback.update({
        reviewedBy,
        reviewComment,
        status: RollbackStatus.REVIEWED,
        reviewedAt: new Date(),
      });

      res.json({ message: 'Rollback reviewed successfully', rollback });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async exportReport(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const buffer = await ReportService.exportTaskReport(id);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="task-report-${id}.xlsx"`);
      res.send(buffer);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async getDashboardStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await ReportService.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async getTaskTrend(req: Request, res: Response): Promise<void> {
    try {
      const { days = 7 } = req.query;
      const trend = await ReportService.getTaskTrend(Number(days));
      res.json(trend);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
}
