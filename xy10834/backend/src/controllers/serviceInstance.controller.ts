import { Request, Response, NextFunction } from 'express';
import serviceInstanceService from '../services/serviceInstance.service';

export async function createServiceInstance(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await serviceInstanceService.create(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getServiceInstances(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await serviceInstanceService.findAll({
      page: parseInt(req.query.page as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 20,
      serviceName: req.query.serviceName as string,
      env: req.query.env as string,
      status: req.query.status as any,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getServiceInstance(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await serviceInstanceService.findById(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function heartbeat(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await serviceInstanceService.heartbeat(
      req.body.instanceId,
      req.body.env
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function updateInstanceStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await serviceInstanceService.updateStatus(req.params.id, req.body.status);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function deleteServiceInstance(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await serviceInstanceService.delete(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}
