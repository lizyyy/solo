import { Request, Response } from 'express';
import { forecastReportService } from '../services/forecastReportService';
import { sendSuccess, sendError } from '../utils/response';

export class ForecastReportController {
  async generate(req: Request, res: Response) {
    try {
      const { name, description, budgetVersionId, submissionId, type, data, affectsFinalResult, actorId } = req.body;

      if (!actorId) {
        return sendError(res, new Error('缺少操作人标识 actorId'), 400);
      }

      if (!name || !budgetVersionId || !type || !data) {
        return sendError(res, new Error('缺少必要参数'), 400);
      }

      const result = await forecastReportService.generate({
        name,
        description,
        budgetVersionId,
        submissionId,
        type,
        data,
        affectsFinalResult,
        actorId
      });

      const affectsMessage = affectsFinalResult !== false
        ? '，该报表将影响最终预测结果'
        : '，该报表不影响最终预测结果';

      return sendSuccess(
        res,
        `已生成预测报表「${name}」${affectsMessage}`,
        {
          id: result.id,
          name: result.name,
          type: result.type,
          affectsFinalResult: result.affectsFinalResult
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
      const result = await forecastReportService.getById(id);

      return sendSuccess(res, '查询成功', result);
    } catch (error) {
      return sendError(res, error as Error, 400);
    }
  }

  async list(req: Request, res: Response) {
    try {
      const { budgetVersionId, submissionId, type, affectsFinalResult } = req.query;
      const filters: any = {};

      if (budgetVersionId) filters.budgetVersionId = budgetVersionId;
      if (submissionId) filters.submissionId = submissionId;
      if (type) filters.type = type;
      if (affectsFinalResult !== undefined) filters.affectsFinalResult = affectsFinalResult === 'true';

      const results = await forecastReportService.list(filters);

      return sendSuccess(res, `查询成功，共 ${results.length} 份报表`, results);
    } catch (error) {
      return sendError(res, error as Error, 400);
    }
  }

  async getLatestAffecting(req: Request, res: Response) {
    try {
      const { budgetVersionId } = req.params;
      const result = await forecastReportService.getLatestAffectingReport(budgetVersionId);

      if (!result) {
        return sendSuccess(res, '当前没有影响最终结果的预测报表', null);
      }

      return sendSuccess(res, '查询到最新的影响最终结果的预测报表', result);
    } catch (error) {
      return sendError(res, error as Error, 400);
    }
  }

  async updateAffectsFinalResult(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { actorId, affectsFinalResult } = req.body;

      if (!actorId) {
        return sendError(res, new Error('缺少操作人标识 actorId'), 400);
      }

      if (affectsFinalResult === undefined) {
        return sendError(res, new Error('请提供 affectsFinalResult 参数'), 400);
      }

      const result = await forecastReportService.updateAffectsFinalResult(
        id,
        actorId,
        affectsFinalResult
      );

      const message = affectsFinalResult
        ? '该报表已设置为影响最终预测结果'
        : '该报表已设置为不影响最终预测结果';

      return sendSuccess(res, message, {
        id: result.id,
        affectsFinalResult: result.affectsFinalResult
      });
    } catch (error) {
      return sendError(res, error as Error, 400);
    }
  }

  async getBudgetFinalResult(req: Request, res: Response) {
    try {
      const { budgetVersionId } = req.params;
      const result = await forecastReportService.getBudgetFinalResult(budgetVersionId);

      const statusMessages: Record<string, string> = {
        DRAFT: '预算版本处于草稿状态，可继续编辑',
        SUBMITTED: '预算版本已提交，等待审核',
        UNDER_REVIEW: '预算版本正在审核中',
        APPROVED: '预算版本已通过审批',
        LOCKED: '预算版本已锁定，财务数据已固化',
        REJECTED: '预算版本已被驳回',
        ROLLBACK_REQUESTED: '预算版本已申请回退，等待审批',
        ROLLBACK_APPROVED: '预算版本回退已批准',
        ROLLBACK_REJECTED: '预算版本回退申请已驳回'
      };

      const statusLabel = statusMessages[result.budgetVersion.status] || '预算版本状态未知';

      const reportMessage = result.affectedByReports
        ? '最终预测结果受到预测报表影响'
        : '最终预测结果未受报表影响';

      return sendSuccess(res, `${statusLabel}。${reportMessage}。`, {
        ...result,
        statusLabel: statusLabel
      });
    } catch (error) {
      return sendError(res, error as Error, 400);
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { actorId } = req.body;

      if (!actorId) {
        return sendError(res, new Error('缺少操作人标识 actorId'), 400);
      }

      await forecastReportService.delete(id, actorId);

      return sendSuccess(res, '预测报表已删除');
    } catch (error) {
      return sendError(res, error as Error, 400);
    }
  }
}

export const forecastReportController = new ForecastReportController();
