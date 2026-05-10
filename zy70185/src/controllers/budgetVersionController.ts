import { Request, Response } from 'express';
import { budgetVersionService } from '../services/budgetVersionService';
import { sendSuccess, sendError } from '../utils/response';
import { stateMachineService } from '../services/stateMachine';

export class BudgetVersionController {
  async create(req: Request, res: Response) {
    try {
      const { year, quarter, description, previousVersionId, actorId } = req.body;

      if (!actorId) {
        return sendError(res, new Error('缺少操作人标识 actorId'), 400);
      }

      const result = await budgetVersionService.create({
        year,
        quarter,
        description,
        previousVersionId,
        actorId
      });

      return sendSuccess(
        res,
        `已成功创建 ${year} 年第 ${quarter} 季度第 ${result.version} 轮滚动预测版本`,
        {
          id: result.id,
          year: result.year,
          quarter: result.quarter,
          version: result.version,
          status: result.status,
          statusLabel: stateMachineService.getBudgetVersionStatusLabel(result.status)
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
      const result = await budgetVersionService.getById(id);

      return sendSuccess(res, '查询成功', {
        ...result,
        statusLabel: stateMachineService.getBudgetVersionStatusLabel(result.status)
      });
    } catch (error) {
      return sendError(res, error as Error, 400);
    }
  }

  async list(req: Request, res: Response) {
    try {
      const { year, quarter, status } = req.query;
      const filters: any = {};

      if (year) filters.year = parseInt(year as string, 10);
      if (quarter) filters.quarter = parseInt(quarter as string, 10);
      if (status) filters.status = status;

      const results = await budgetVersionService.list(filters);

      const formatted = results.map(r => ({
        ...r,
        statusLabel: stateMachineService.getBudgetVersionStatusLabel(r.status)
      }));

      return sendSuccess(res, `查询成功，共 ${formatted.length} 条记录`, formatted);
    } catch (error) {
      return sendError(res, error as Error, 400);
    }
  }

  async submit(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { actorId } = req.body;

      if (!actorId) {
        return sendError(res, new Error('缺少操作人标识 actorId'), 400);
      }

      const result = await budgetVersionService.submit(id, actorId);

      return sendSuccess(res, '预算版本已提交审核', {
        id: result.id,
        status: result.status,
        statusLabel: stateMachineService.getBudgetVersionStatusLabel(result.status)
      });
    } catch (error) {
      return sendError(res, error as Error, 400);
    }
  }

  async review(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { actorId } = req.body;

      if (!actorId) {
        return sendError(res, new Error('缺少操作人标识 actorId'), 400);
      }

      const result = await budgetVersionService.review(id, actorId);

      return sendSuccess(res, '预算版本已进入审核状态', {
        id: result.id,
        status: result.status,
        statusLabel: stateMachineService.getBudgetVersionStatusLabel(result.status)
      });
    } catch (error) {
      return sendError(res, error as Error, 400);
    }
  }

  async approve(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { actorId } = req.body;

      if (!actorId) {
        return sendError(res, new Error('缺少操作人标识 actorId'), 400);
      }

      const result = await budgetVersionService.approve(id, actorId);

      return sendSuccess(res, '预算版本已批准', {
        id: result.id,
        status: result.status,
        statusLabel: stateMachineService.getBudgetVersionStatusLabel(result.status)
      });
    } catch (error) {
      return sendError(res, error as Error, 400);
    }
  }

  async reject(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { actorId, reason } = req.body;

      if (!actorId) {
        return sendError(res, new Error('缺少操作人标识 actorId'), 400);
      }

      const result = await budgetVersionService.reject(id, actorId, reason);

      return sendSuccess(res, '预算版本已驳回', {
        id: result.id,
        status: result.status,
        statusLabel: stateMachineService.getBudgetVersionStatusLabel(result.status)
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

      const result = await budgetVersionService.lock(id, actorId);

      return sendSuccess(res, '预算版本已锁定，财务数据已固化', {
        id: result.id,
        status: result.status,
        statusLabel: stateMachineService.getBudgetVersionStatusLabel(result.status),
        lockedAt: result.lockedAt,
        lockedBy: result.lockedBy
      });
    } catch (error) {
      return sendError(res, error as Error, 400);
    }
  }

  async requestRollback(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { actorId, reason } = req.body;

      if (!actorId) {
        return sendError(res, new Error('缺少操作人标识 actorId'), 400);
      }

      if (!reason) {
        return sendError(res, new Error('请提供回退原因'), 400);
      }

      const result = await budgetVersionService.requestRollback(id, actorId, reason);

      return sendSuccess(res, '已提交回退申请，等待审批', {
        id: result.id,
        status: result.status,
        statusLabel: stateMachineService.getBudgetVersionStatusLabel(result.status)
      });
    } catch (error) {
      return sendError(res, error as Error, 400);
    }
  }

  async approveRollback(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { actorId } = req.body;

      if (!actorId) {
        return sendError(res, new Error('缺少操作人标识 actorId'), 400);
      }

      const result = await budgetVersionService.approveRollback(id, actorId);

      return sendSuccess(res, '回退已批准，预算版本已解锁', {
        id: result.id,
        status: result.status,
        statusLabel: stateMachineService.getBudgetVersionStatusLabel(result.status)
      });
    } catch (error) {
      return sendError(res, error as Error, 400);
    }
  }

  async rejectRollback(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { actorId, reason } = req.body;

      if (!actorId) {
        return sendError(res, new Error('缺少操作人标识 actorId'), 400);
      }

      const result = await budgetVersionService.rejectRollback(id, actorId, reason);

      return sendSuccess(res, '回退申请已驳回，预算版本保持锁定状态', {
        id: result.id,
        status: result.status,
        statusLabel: stateMachineService.getBudgetVersionStatusLabel(result.status)
      });
    } catch (error) {
      return sendError(res, error as Error, 400);
    }
  }
}

export const budgetVersionController = new BudgetVersionController();
