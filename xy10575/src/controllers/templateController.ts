import { Request, Response } from 'express';
import { templateService } from '../services/templateService';
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

export async function createTemplate(req: Request, res: Response) {
  try {
    const operator = getOperator(req);
    const template = await templateService.createTemplate(req.body, operator);
    res.json({ success: true, data: template } as AppResponse<typeof template>);
  } catch (error) {
    handleError(res, error);
  }
}

export async function getTemplate(req: Request, res: Response) {
  try {
    const template = await templateService.getTemplateById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, error: '模板不存在' } as AppResponse<null>);
    }
    res.json({ success: true, data: template } as AppResponse<typeof template>);
  } catch (error) {
    handleError(res, error);
  }
}

export async function getTemplatesByEquipment(req: Request, res: Response) {
  try {
    const templates = await templateService.getTemplatesByEquipment(req.params.equipmentId);
    res.json({ success: true, data: templates } as AppResponse<typeof templates>);
  } catch (error) {
    handleError(res, error);
  }
}

export async function addCheckItem(req: Request, res: Response) {
  try {
    const operator = getOperator(req);
    const item = await templateService.addItem(req.body, operator);
    res.json({ success: true, data: item } as AppResponse<typeof item>);
  } catch (error) {
    handleError(res, error);
  }
}

export async function getTemplateItems(req: Request, res: Response) {
  try {
    const items = await templateService.getItemsByTemplate(req.params.id);
    res.json({ success: true, data: items } as AppResponse<typeof items>);
  } catch (error) {
    handleError(res, error);
  }
}
