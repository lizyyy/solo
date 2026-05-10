import { Request, Response } from 'express';
import { taskService, CreateTaskDto } from '../services/taskService';
import { handleError } from '../utils/errorHandler';

export const taskController = {
  async getAllTasks(req: Request, res: Response) {
    try {
      const tasks = await taskService.getAllTasks();
      res.json({ success: true, data: tasks });
    } catch (error) {
      handleError(res, error);
    }
  },

  async getTaskById(req: Request, res: Response) {
    try {
      const task = await taskService.getTaskById(req.params.id);
      res.json({ success: true, data: task });
    } catch (error) {
      handleError(res, error);
    }
  },

  async createTask(req: Request, res: Response) {
    try {
      const data: CreateTaskDto = req.body;
      const task = await taskService.createTask(data);
      res.status(201).json({ success: true, data: task });
    } catch (error) {
      handleError(res, error);
    }
  },

  async assignTask(req: Request, res: Response) {
    try {
      const { taskId, vehicleId } = req.body;
      const task = await taskService.assignTask(taskId, vehicleId);
      res.json({ success: true, data: task });
    } catch (error) {
      handleError(res, error);
    }
  },

  async confirmTask(req: Request, res: Response) {
    try {
      const task = await taskService.confirmTask(req.params.id);
      res.json({ success: true, data: task });
    } catch (error) {
      handleError(res, error);
    }
  },

  async rejectTask(req: Request, res: Response) {
    try {
      const { reason } = req.body;
      const task = await taskService.rejectTask(req.params.id, reason);
      res.json({ success: true, data: task });
    } catch (error) {
      handleError(res, error);
    }
  },

  async completeTask(req: Request, res: Response) {
    try {
      const { snowThicknessAfter, qualityScore } = req.body;
      const task = await taskService.completeTask(req.params.id, snowThicknessAfter, qualityScore);
      res.json({ success: true, data: task });
    } catch (error) {
      handleError(res, error);
    }
  },

  async cancelTask(req: Request, res: Response) {
    try {
      const { reason } = req.body;
      const task = await taskService.cancelTask(req.params.id, reason);
      res.json({ success: true, data: task });
    } catch (error) {
      handleError(res, error);
    }
  },

  async autoSchedule(req: Request, res: Response) {
    try {
      const result = await taskService.autoSchedule();
      res.json({ success: true, data: result });
    } catch (error) {
      handleError(res, error);
    }
  },

  async exportTasks(req: Request, res: Response) {
    try {
      const format = (req.query.format as 'json' | 'excel') || 'json';
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      
      const result = await taskService.exportTasks(format, startDate, endDate);
      
      if (format === 'excel') {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="tasks-${Date.now()}.xlsx"`);
        res.send(result);
      } else {
        res.json({ success: true, data: result });
      }
    } catch (error) {
      handleError(res, error);
    }
  }
};
