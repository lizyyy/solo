import { Request, Response, NextFunction } from 'express';
import configItemService from '../services/configItem.service';

export async function createConfigItem(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await configItemService.create(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getConfigItems(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await configItemService.findAll({
      page: parseInt(req.query.page as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 20,
      status: req.query.status as any,
      key: req.query.key as string,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getConfigItem(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await configItemService.findById(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function updateConfigItem(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await configItemService.update(req.params.id, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function deleteConfigItem(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await configItemService.delete(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}
