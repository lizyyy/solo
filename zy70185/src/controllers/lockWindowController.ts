import { Request, Response } from 'express';
import { lockWindowService } from '../services/lockWindowService';
import { sendSuccess, sendError } from '../utils/response';
import { stateMachineService } from '../services/stateMachine';

export class LockWindowController {
  async create(req: Request, res: Response) {
    try {
      const { budgetVersionId, name, description, startDate, endDate, actorId } = req.body;

      if (!actorId) {
        return sendError(res, new Error('缺少操作人标识 actorId'), 400);
      }

      if (!budgetVersionId || !name || !startDate || !endDate) {
        return sendError(res, new Error('缺少必要参数'), 400);
      }

      const result = await lockWindowService.create({
        budgetVersionId,
        name,
        description,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        actorId
      });

      return sendSuccess(
        res,
        `已创建锁定窗口「${name}」，开放时间：${result.startDate.toLocaleString()} ~ ${result.endDate.toLocaleString()}`,
        {
          id: result.id,
          name: result.name,
          status: result.status,
          statusLabel: stateMachineService.getLockWindowStatusLabel(result.status),
          startDate: result.startDate,
          endDate: result.endDate
        },
        201
      );
    } catch (error) {
      return sendError(res, error as Error, 400);
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await lockWindowService.getById(id);

      const isActive = lockWindowService.isWindowActive(result);

      return sendSuccess(res, '查询成功', {
        ...result,
        statusLabel: stateMachineService.getLockWindowStatusLabel(result.status),
        isActive
      });
    } catch (error) {
      return sendError(res, error as Error, 400);
    }
  }

  async list(req: Request, res: Response) {
    try {
      const { budgetVersionId, status } = req.query;
      const filters: any = {};

      if (budgetVersionId) filters.budgetVersionId = budgetVersionId;
      if (status) filters.status = status;

      const results = await lockWindowService.list(filters);

      const formatted = results.map(r => ({
        ...r,
        statusLabel: stateMachineService.getLockWindowStatusLabel(r.status),
        isActive: lockWindowService.isWindowActive(r)
      }));

      return sendSuccess(res, `查询成功，共 ${formatted.length} 条记录`, formatted);
    } catch (error) {
      return sendError(res, error as Error, 400);
    }
  }

  async getActive(req: Request, res: Response) {
    try {
      const { budgetVersionId } = req.params;

      const result = await lockWindowService.getActiveWindow(budgetVersionId);

      if (!result) {
        return sendSuccess(res, '当前没有开放的提交窗口期', null);
      }

      return sendSuccess(res, '查询到当前开放的提交窗口', {
        ...result,
        statusLabel: stateMachineService.getLockWindowStatusLabel(result.status),
        isActive: true
      });
    } catch (error) {
      return sendError(res, error as Error, 400);
    }
  }

  async close(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { actorId } = req.body;

      if (!actorId) {
        return sendError(res, new Error('缺少操作人标识 actorId'), 400);
      }

      const result = await lockWindowService.close(id, actorId);

      return sendSuccess(res, '锁定窗口已关闭，不再接受新的提交', {
        id: result.id,
        status: result.status,
        statusLabel: stateMachineService.getLockWindowStatusLabel(result.status)
      });
    } catch (error) {
      return sendError(res, error as Error, 400);
    }
  }

  async reopen(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { actorId } = req.body;

      if (!actorId) {
        return sendError(res, new Error('缺少操作人标识 actorId'), 400);
      }

      const result = await lockWindowService.reopen(id, actorId);

      return sendSuccess(res, '锁定窗口已重新开放', {
        id: result.id,
        status: result.status,
        statusLabel: stateMachineService.getLockWindowStatusLabel(result.status)
      });
    } catch (error) {
      return sendError(res, error as Error, 400);
    }
  }

  async lock(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { actorId } = req.body;

      if (!actorId) {
        return sendError(res, new Error('缺少操作人标识 actorId'), 400);
      }

      const result = await lockWindowService.lock(id, actorId);

      return sendSuccess(res, '锁定窗口已最终锁定，窗口期数据已固化', {
        id: result.id,
        status: result.status,
        statusLabel: stateMachineService.getLockWindowStatusLabel(result.status)
      });
    } catch (error) {
      return sendError(res, error as Error, 400);
    }
  }

  async extend(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { actorId, newEndDate } = req.body;

      if (!actorId) {
        return sendError(res, new Error('缺少操作人标识 actorId'), 400);
      }

      if (!newEndDate) {
        return sendError(res, new Error('请提供新的结束时间'), 400);
      }

      const result = await lockWindowService.extend(id, actorId, new Date(newEndDate));

      return sendSuccess(res, `锁定窗口已延长至 ${result.endDate.toLocaleString()}`, {
        id: result.id,
        endDate: result.endDate
      });
    } catch (error) {
      return sendError(res, error as Error, 400);
    }
  }
}

export const lockWindowController = new LockWindowController();
