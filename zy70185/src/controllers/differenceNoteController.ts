import { Request, Response } from 'express';
import { differenceNoteService } from '../services/differenceNoteService';
import { sendSuccess, sendError } from '../utils/response';

export class DifferenceNoteController {
  async create(req: Request, res: Response) {
    try {
      const { submissionId, category, description, amount, previousValue, currentValue, actorId } = req.body;

      if (!actorId) {
        return sendError(res, new Error('缺少操作人标识 actorId'), 400);
      }

      if (!submissionId || !category || !description || amount === undefined) {
        return sendError(res, new Error('缺少必要参数'), 400);
      }

      const result = await differenceNoteService.create({
        submissionId,
        category,
        description,
        amount,
        previousValue,
        currentValue,
        actorId
      });

      return sendSuccess(
        res,
        '已添加差异说明',
        {
          id: result.id,
          category: result.category,
          description: result.description,
          amount: result.amount
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
      const result = await differenceNoteService.getById(id);

      return sendSuccess(res, '查询成功', result);
    } catch (error) {
      return sendError(res, error as Error, 400);
    }
  }

  async listBySubmission(req: Request, res: Response) {
    try {
      const { submissionId } = req.params;
      const results = await differenceNoteService.listBySubmission(submissionId);

      return sendSuccess(res, `查询成功，共 ${results.length} 条差异说明`, results);
    } catch (error) {
      return sendError(res, error as Error, 400);
    }
  }

  async listByBudgetVersion(req: Request, res: Response) {
    try {
      const { budgetVersionId } = req.params;
      const results = await differenceNoteService.listByBudgetVersion(budgetVersionId);

      return sendSuccess(res, `查询成功，共 ${results.length} 条差异说明`, results);
    } catch (error) {
      return sendError(res, error as Error, 400);
    }
  }

  async getSummary(req: Request, res: Response) {
    try {
      const { budgetVersionId } = req.params;
      const summary = await differenceNoteService.getSummary(budgetVersionId);

      const message = summary.totalNotes > 0
        ? `共 ${summary.totalNotes} 条差异说明，差异总额：${summary.totalAmount.toLocaleString()} 元`
        : '暂无差异说明';

      return sendSuccess(res, message, summary);
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

      await differenceNoteService.delete(id, actorId);

      return sendSuccess(res, '差异说明已删除');
    } catch (error) {
      return sendError(res, error as Error, 400);
    }
  }
}

export const differenceNoteController = new DifferenceNoteController();
