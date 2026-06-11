import { Request, Response } from 'express';
import { planService } from '../services/planService';
import type { UpdateRemarkRequest, UpdateJudgmentRequest, AddMaterialRequest, UpdateStatusRequest, ApiResponse } from '../../shared/types';

function success<T>(res: Response, data: T, message = '操作成功') {
  res.json({
    code: 0,
    message,
    data,
  } as ApiResponse<T>);
}

function error(res: Response, message: string, code = 1) {
  res.status(400).json({
    code,
    message,
    data: null,
  } as ApiResponse<null>);
}

export const planController = {
  getPlanList(req: Request, res: Response) {
    try {
      const { status, keyword } = req.query;
      const params: { status?: any; keyword?: string } = {};
      
      if (status && typeof status === 'string') {
        params.status = status;
      }
      if (keyword && typeof keyword === 'string') {
        params.keyword = keyword;
      }

      const plans = planService.getPlanList(params);
      success(res, plans);
    } catch (err) {
      error(res, (err as Error).message);
    }
  },

  getPlanDetail(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const plan = planService.getPlanDetail(id);
      
      if (!plan) {
        return error(res, '方案不存在', 404);
      }

      success(res, plan);
    } catch (err) {
      error(res, (err as Error).message);
    }
  },

  createPlan(req: Request, res: Response) {
    try {
      const plan = planService.createPlan(req.body);
      success(res, plan, '创建成功');
    } catch (err) {
      error(res, (err as Error).message);
    }
  },

  updateRemark(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { remark, changeReason, operator } = req.body as UpdateRemarkRequest;

      if (!remark) {
        return error(res, '备注内容不能为空');
      }
      if (!changeReason) {
        return error(res, '请填写变更原因');
      }
      if (!operator) {
        return error(res, '请填写操作人');
      }

      const plan = planService.updateRemark(id, remark, changeReason, operator);
      success(res, plan, '备注更新成功，历史版本已记录');
    } catch (err) {
      error(res, (err as Error).message);
    }
  },

  updateJudgment(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { newJudgment, changeReason, operator } = req.body as UpdateJudgmentRequest;

      if (!newJudgment) {
        return error(res, '请选择新的判断结论');
      }
      if (!changeReason) {
        return error(res, '请填写调整原因');
      }
      if (!operator) {
        return error(res, '请填写操作人');
      }

      const plan = planService.updateJudgment(id, newJudgment, changeReason, operator);
      success(res, plan, '判断调整成功，新旧判断已记录');
    } catch (err) {
      error(res, (err as Error).message);
    }
  },

  updateStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status, operator } = req.body as UpdateStatusRequest;

      if (!status) {
        return error(res, '请选择状态');
      }
      if (!operator) {
        return error(res, '请填写操作人');
      }

      const plan = planService.updateStatus(id, status, operator);
      success(res, plan, '状态更新成功');
    } catch (err) {
      error(res, (err as Error).message);
    }
  },

  addMaterial(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { batchNo, materialName, quantity, supplementReason, operator } = req.body as AddMaterialRequest;

      if (!batchNo) {
        return error(res, '请填写材料批次号');
      }
      if (!materialName) {
        return error(res, '请填写材料名称');
      }
      if (!supplementReason) {
        return error(res, '请填写补录原因');
      }
      if (!operator) {
        return error(res, '请填写操作人');
      }

      const plan = planService.addMaterial(id, batchNo, materialName, quantity || 1, supplementReason, operator);
      success(res, plan, '材料补录成功，状态已自动更新');
    } catch (err) {
      error(res, (err as Error).message);
    }
  },

  getHistory(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const plan = planService.getPlanDetail(id);
      
      if (!plan) {
        return error(res, '方案不存在', 404);
      }

      success(res, plan.history);
    } catch (err) {
      error(res, (err as Error).message);
    }
  },

  exportPlan(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { format = 'json' } = req.query;

      const result = planService.exportPlan(id, format as 'json' | 'csv');

      res.setHeader('Content-Type', result.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.content);
    } catch (err) {
      error(res, (err as Error).message);
    }
  },
};
