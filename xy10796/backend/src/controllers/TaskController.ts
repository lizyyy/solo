import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { StateMachineService, TaskStatus, RollbackStatus } from '../services/StateMachineService';
import { IdempotencyService } from '../services/IdempotencyService';
import { ReportService } from '../services/ReportService';

export class TaskController {
  static async createTask(req: Request, res: Response): Promise<void> {
    try {
      const { environmentId, datasetId, requestId, maxRetries = 3 } = req.body;

      if (!environmentId || !datasetId) {
        res.status(400).json({ error: 'environmentId and datasetId are required' });
        return;
      }

      const idempotencyKey = IdempotencyService.generateKey({
        environmentId,
        datasetId,
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

      await db.read();
      const environment = db.data.environments.find(e => e.id === environmentId);
      const dataset = db.data.datasets.find(d => d.id === datasetId);
      
      if (!environment || !dataset) {
        res.status(404).json({ error: 'Environment or Dataset not found' });
        return;
      }

      const taskId = uuidv4();
      const newTask = {
        id: taskId,
        idempotencyKey,
        environmentId,
        datasetId,
        status: TaskStatus.PENDING,
        importOrder: dataset.importOrder,
        retryCount: 0,
        maxRetries,
        totalRecords: 0,
        successRecords: 0,
        failedRecords: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      db.data.tasks.push(newTask);
      await db.write();

      setTimeout(() => StateMachineService.processTask(taskId), 100);

      res.status(201).json({
        message: 'Task created successfully',
        isDuplicate: false,
        task: newTask,
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
        datasetId,
        page = 1,
        limit = 20,
        startDate,
        endDate,
      } = req.query;

      await db.read();
      let tasks = [...db.data.tasks];

      if (status) tasks = tasks.filter(t => t.status === status);
      if (environmentId) tasks = tasks.filter(t => t.environmentId === environmentId);
      if (datasetId) tasks = tasks.filter(t => t.datasetId === datasetId);
      if (startDate) tasks = tasks.filter(t => t.createdAt >= startDate);
      if (endDate) tasks = tasks.filter(t => t.createdAt <= endDate);

      tasks = tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const pageNum = Number(page);
      const limitNum = Number(limit);
      const start = (pageNum - 1) * limitNum;
      const paginatedTasks = tasks.slice(start, start + limitNum);

      const tasksWithRelations = paginatedTasks.map(task => ({
        ...task,
        Environment: db.data.environments.find(e => e.id === task.environmentId),
        Dataset: db.data.datasets.find(d => d.id === task.datasetId),
      }));

      res.json({
        tasks: tasksWithRelations,
        total: tasks.length,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(tasks.length / limitNum),
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async getTaskById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await db.read();
      const task = db.data.tasks.find(t => t.id === id);

      if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      const records = db.data.seedRecords.filter(r => r.taskId === id);
      const rollbacks = db.data.rollbackRecords.filter(r => r.taskId === id);

      const environment = db.data.environments.find(e => e.id === task.environmentId);
      const dataset = db.data.datasets.find(d => d.id === task.datasetId);

      res.json({
        task: { ...task, Environment: environment, Dataset: dataset },
        records,
        rollbacks,
      });
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

      await db.read();
      const rollback = db.data.rollbackRecords.find(r => r.id === rollbackId);
      if (!rollback) {
        res.status(404).json({ error: 'Rollback record not found' });
        return;
      }

      rollback.reviewedBy = reviewedBy;
      rollback.reviewComment = reviewComment;
      rollback.status = RollbackStatus.REVIEWED;
      rollback.reviewedAt = new Date().toISOString();
      rollback.updatedAt = new Date().toISOString();
      await db.write();

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
