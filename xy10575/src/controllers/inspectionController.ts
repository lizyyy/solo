import { Request, Response } from 'express';
import { inspectionService } from '../services/inspectionService';
import { AppResponse } from '../models';
import { BusinessError } from '../services/equipmentService';

function handleError(res: Response, error: any) {
  if (error instanceof BusinessError) {
    return res.status(400).json({
      success: false,
      error: error.message,
      errorCode: error.code
    } as AppResponse<null>);
  }
  console.error(error);
  return res.status(500).json({
    success: false,
    error: '服务器内部错误'
  } as AppResponse<null>);
}

function getOperator(req: Request): { id: string; name: string } {
  return {
    id: req.headers['x-operator-id'] as string || 'system',
    name: req.headers['x-operator-name'] as string || '系统管理员'
  };
}

export async function createInspection(req: Request, res: Response) {
  try {
    const operator = getOperator(req);
    const inspection = await inspectionService.create(req.body, operator);
    res.json({ success: true, data: inspection } as AppResponse<typeof inspection>);
  } catch (error) {
    handleError(res, error);
  }
}

export async function getInspection(req: Request, res: Response) {
  try {
    const inspection = await inspectionService.getById(req.params.id);
    if (!inspection) {
      return res.status(404).json({ success: false, error: '点检记录不存在' } as AppResponse<null>);
    }
    res.json({ success: true, data: inspection } as AppResponse<typeof inspection>);
  } catch (error) {
    handleError(res, error);
  }
}

export async function getAllInspections(req: Request, res: Response) {
  try {
    const { equipmentId, shiftDate, status } = req.query;
    const inspections = await inspectionService.getAll({
      equipmentId: equipmentId as string,
      shiftDate: shiftDate as string,
      status: status as string
    });
    res.json({ success: true, data: inspections } as AppResponse<typeof inspections>);
  } catch (error) {
    handleError(res, error);
  }
}

export async function checkItem(req: Request, res: Response) {
  try {
    const operator = getOperator(req);
    const { itemId, actualValue, isNormal, remark } = req.body;
    const result = await inspectionService.checkItem(
      req.params.id,
      { itemId, actualValue, isNormal, remark },
      operator
    );
    res.json({ success: true, data: result } as AppResponse<typeof result>);
  } catch (error) {
    handleError(res, error);
  }
}

export async function getInspectionItemResults(req: Request, res: Response) {
  try {
    const results = await inspectionService.getItemResults(req.params.id);
    res.json({ success: true, data: results } as AppResponse<typeof results>);
  } catch (error) {
    handleError(res, error);
  }
}

export async function completeInspection(req: Request, res: Response) {
  try {
    const operator = getOperator(req);
    const inspection = await inspectionService.complete(req.params.id, operator);
    res.json({ success: true, data: inspection } as AppResponse<typeof inspection>);
  } catch (error) {
    handleError(res, error);
  }
}

export async function closeInspection(req: Request, res: Response) {
  try {
    const operator = getOperator(req);
    const inspection = await inspectionService.close(req.params.id, operator);
    res.json({ success: true, data: inspection } as AppResponse<typeof inspection>);
  } catch (error) {
    handleError(res, error);
  }
}
