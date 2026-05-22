import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { PreparationService } from '../services/preparation';
import { SecurityService } from '../services/security';
import { PreparationStatus, RecordSource } from '../types';

export function createPhotoRouter(service: PreparationService): Router {
  const router = Router();

  router.post('/', async (req: AuthRequest, res: Response) => {
    if (!req.user) return res.status(401).json({ success: false, message: '未认证', timestamp: Date.now() });
    if (!SecurityService.canEdit(req.user.role)) {
      return res.status(403).json({ success: false, message: '无编辑权限', timestamp: Date.now() });
    }

    const { changeReason, ...data } = req.body;
    const ipAddress = req.ip;

    const result = await service.submitPhotoInventory(
      data,
      req.user,
      changeReason || '提交照片清单',
      ipAddress
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        errors: result.errors,
        message: '数据验证失败',
        requestId: data.requestId,
        timestamp: Date.now()
      });
    }

    res.json({
      success: true,
      data: SecurityService.maskPhotoInventory(result.data!, req.user.role),
      message: result.isUpdate ? '更新成功' : '创建成功',
      requestId: data.requestId,
      isUpdate: result.isUpdate,
      timestamp: Date.now()
    });
  });

  router.get('/:requestId', async (req: AuthRequest, res: Response) => {
    if (!req.user) return res.status(401).json({ success: false, message: '未认证', timestamp: Date.now() });

    const inventory = await service.getPhotoInventory(req.params.requestId);
    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: '记录不存在',
        requestId: req.params.requestId,
        timestamp: Date.now()
      });
    }

    res.json({
      success: true,
      data: SecurityService.maskPhotoInventory(inventory, req.user.role),
      requestId: req.params.requestId,
      timestamp: Date.now()
    });
  });

  router.post('/:requestId/status', async (req: AuthRequest, res: Response) => {
    if (!req.user) return res.status(401).json({ success: false, message: '未认证', timestamp: Date.now() });
    if (!SecurityService.canEdit(req.user.role)) {
      return res.status(403).json({ success: false, message: '无编辑权限', timestamp: Date.now() });
    }

    const { newStatus, changeReason } = req.body;

    if (!Object.values(PreparationStatus).includes(newStatus)) {
      return res.status(400).json({
        success: false,
        message: '无效的状态值',
        requestId: req.params.requestId,
        timestamp: Date.now()
      });
    }

    const result = await service.changeStatus(
      req.params.requestId,
      RecordSource.PHOTO,
      newStatus,
      req.user,
      changeReason || '状态变更',
      req.ip
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
        requestId: req.params.requestId,
        timestamp: Date.now()
      });
    }

    res.json({
      success: true,
      message: '状态变更成功',
      requestId: req.params.requestId,
      timestamp: Date.now()
    });
  });

  return router;
}
