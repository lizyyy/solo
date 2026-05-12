import { Request, Response } from 'express';
import { equipmentService, BusinessError } from '../services/equipmentService';
import { AppResponse, EquipmentStatus } from '../models';

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

export async function createEquipment(req: Request, res: Response) {
  try {
    const operator = getOperator(req);
    const equipment = await equipmentService.create(req.body, operator);
    res.json({ success: true, data: equipment } as AppResponse<typeof equipment>);
  } catch (error) {
    handleError(res, error);
  }
}

export async function getEquipment(req: Request, res: Response) {
  try {
    const equipment = await equipmentService.getById(req.params.id);
    if (!equipment) {
      return res.status(404).json({ success: false, error: '设备不存在' } as AppResponse<null>);
    }
    res.json({ success: true, data: equipment } as AppResponse<typeof equipment>);
  } catch (error) {
    handleError(res, error);
  }
}

export async function getAllEquipment(req: Request, res: Response) {
  try {
    const equipment = await equipmentService.getAll();
    res.json({ success: true, data: equipment } as AppResponse<typeof equipment>);
  } catch (error) {
    handleError(res, error);
  }
}

export async function updateEquipmentStatus(req: Request, res: Response) {
  try {
    const operator = getOperator(req);
    const { status, reason } = req.body;
    const equipment = await equipmentService.updateStatus(req.params.id, status as EquipmentStatus, operator, reason);
    res.json({ success: true, data: equipment } as AppResponse<typeof equipment>);
  } catch (error) {
    handleError(res, error);
  }
}
