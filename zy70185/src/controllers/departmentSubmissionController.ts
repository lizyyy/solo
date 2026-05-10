import { Request, Response } from 'express';
import { departmentSubmissionService } from '../services/departmentSubmissionService';
import { sendSuccess, sendError } from '../utils/response';
import { stateMachineService } from '../services/stateMachine';

export class DepartmentSubmissionController {
  async create(req: Request, res: Response) {
    try {
      const { budgetVersionId, departmentId, actorId, data } = req.body;

      if (!actorId) {
        return sendError(res, new Error('缺少操作人标识 actorId'), 400);
      }

      if (!budgetVersionId || !departmentId) {
        return sendError(res, new Error('缺少预算版本或部门信息'), 400);
      }

      const result = await departmentSubmissionService.create({
        budgetVersionId,
        departmentId,
        actorId,
        data
      });

      return sendSuccess(
        res,
        '已创建部门提交记录',
        {
          id: result.id,
          version: result.version,
          status: result.status,
          statusLabel: stateMachineService.getDepartmentSubmissionStatusLabel(result.status)
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
      const result = await departmentSubmissionService.getById(id);

      return sendSuccess(res, '查询成功', {
        ...result,
        statusLabel: stateMachineService.getDepartmentSubmissionStatusLabel(result.status)
      });
    } catch (error) {
      return sendError(res, error as Error, 400);
    }
  }

  async list(req: Request, res: Response) {
    try {
      const { budgetVersionId, departmentId, status } = req.query;
      const filters: any = {};

      if (budgetVersionId) filters.budgetVersionId = budgetVersionId;
      if (departmentId) filters.departmentId = departmentId;
      if (status) filters.status = status;

      const results = await departmentSubmissionService.list(filters);

      const formatted = results.map(r => ({
        ...r,
        statusLabel: stateMachineService.getDepartmentSubmissionStatusLabel(r.status)
      }));

      return sendSuccess(res, `查询成功，共 ${formatted.length} 条记录`, formatted);
    } catch (error) {
      return sendError(res, error as Error, 400);
    }
  }

  async submit(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { actorId, data } = req.body;

      if (!actorId) {
        return sendError(res, new Error('缺少操作人标识 actorId'), 400);
      }

      const result = await departmentSubmissionService.submit({
        id,
        actorId,
        data
      });

      return sendSuccess(res, '部门数据已提交', {
        id: result.id,
        status: result.status,
        statusLabel: stateMachineService.getDepartmentSubmissionStatusLabel(result.status)
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

      const result = await departmentSubmissionService.review(id, actorId);

      return sendSuccess(res, '部门提交已进入审核状态', {
        id: result.id,
        status: result.status,
        statusLabel: stateMachineService.getDepartmentSubmissionStatusLabel(result.status)
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

      const result = await departmentSubmissionService.approve(id, actorId);

      return sendSuccess(res, '部门提交已通过审批', {
        id: result.id,
        status: result.status,
        statusLabel: stateMachineService.getDepartmentSubmissionStatusLabel(result.status)
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

      const result = await departmentSubmissionService.reject(id, actorId, reason);

      return sendSuccess(res, reason ? `部门提交已驳回：${reason}` : '部门提交已驳回，请修改后重新提交', {
        id: result.id,
        status: result.status,
        statusLabel: stateMachineService.getDepartmentSubmissionStatusLabel(result.status)
      });
    } catch (error) {
      return sendError(res, error as Error, 400);
    }
  }

  async resubmit(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { actorId, data } = req.body;

      if (!actorId) {
        return sendError(res, new Error('缺少操作人标识 actorId'), 400);
      }

      const result = await departmentSubmissionService.resubmit(id, actorId, data);

      return sendSuccess(res, '部门数据已更新，可以重新提交', {
        id: result.id,
        status: result.status,
        statusLabel: stateMachineService.getDepartmentSubmissionStatusLabel(result.status)
      });
    } catch (error) {
      return sendError(res, error as Error, 400);
    }
  }

  async updateData(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { actorId, data } = req.body;

      if (!actorId) {
        return sendError(res, new Error('缺少操作人标识 actorId'), 400);
      }

      if (!data) {
        return sendError(res, new Error('缺少要更新的数据'), 400);
      }

      const result = await departmentSubmissionService.updateData(id, actorId, data);

      return sendSuccess(res, '部门数据已更新', {
        id: result.id,
        status: result.status,
        statusLabel: stateMachineService.getDepartmentSubmissionStatusLabel(result.status)
      });
    } catch (error) {
      return sendError(res, error as Error, 400);
    }
  }
}

export const departmentSubmissionController = new DepartmentSubmissionController();
