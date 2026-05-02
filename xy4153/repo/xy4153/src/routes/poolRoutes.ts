import { Router } from 'express';
import { AuthRequest, requireRoles, validateRequestBody } from './middleware';
import { createPool, getPoolById, getPoolsByUser, getPoolsByStore, updatePool, deletePool } from '../storage/poolRepository';
import { getStoreById } from '../storage/storeRepository';
import { UserRole } from '../types';
import { createAuditLog } from '../storage/auditRepository';

const router = Router();

router.get('/', async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: '未授权' });
    }

    const pools = getPoolsByUser(req.user);

    res.json({
      success: true,
      data: pools
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || '获取泳池列表失败'
    });
  }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const pool = getPoolById(id);

    if (!pool) {
      return res.status(404).json({
        success: false,
        error: '泳池不存在'
      });
    }

    res.json({
      success: true,
      data: pool
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || '获取泳池信息失败'
    });
  }
});

router.post(
  '/',
  requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]),
  validateRequestBody({
    storeId: { required: true, type: 'string' },
    name: { required: true, type: 'string' },
    type: { required: true, type: 'string' },
    volume: { required: true, type: 'number' }
  }),
  async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: '未授权' });
      }

      const { storeId, name, type, volume } = req.body;

      const store = getStoreById(storeId);
      if (!store) {
        return res.status(400).json({
          success: false,
          error: '门店不存在'
        });
      }

      const pool = createPool(storeId, name, type, volume, req.user);

      createAuditLog('pool', pool.id, 'create', req.user, {
        afterState: pool
      });

      res.status(201).json({
        success: true,
        data: pool
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || '创建泳池失败'
      });
    }
  }
);

router.put(
  '/:id',
  requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]),
  async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: '未授权' });
      }

      const { id } = req.params;
      const { name, type, volume, isActive } = req.body;

      const existingPool = getPoolById(id);
      if (!existingPool) {
        return res.status(404).json({
          success: false,
          error: '泳池不存在'
        });
      }

      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (type !== undefined) updates.type = type;
      if (volume !== undefined) updates.volume = volume;
      if (isActive !== undefined) updates.isActive = isActive;

      const updatedPool = updatePool(id, updates, req.user);

      if (updatedPool) {
        createAuditLog('pool', id, 'update', req.user, {
          beforeState: existingPool,
          afterState: updatedPool
        });
      }

      res.json({
        success: true,
        data: updatedPool
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || '更新泳池失败'
      });
    }
  }
);

router.delete(
  '/:id',
  requireRoles([UserRole.ADMIN]),
  async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: '未授权' });
      }

      const { id } = req.params;
      const existingPool = getPoolById(id);

      if (!existingPool) {
        return res.status(404).json({
          success: false,
          error: '泳池不存在'
        });
      }

      const success = deletePool(id, req.user);

      if (success) {
        createAuditLog('pool', id, 'delete', req.user, {
          beforeState: existingPool
        });
      }

      res.json({
        success,
        message: success ? '删除成功' : '删除失败'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || '删除泳池失败'
      });
    }
  }
);

export default router;
