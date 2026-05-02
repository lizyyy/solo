import { Router } from 'express';
import { AuthRequest, requireRoles, validateRequestBody } from './middleware';
import { createStore, getStoreById, getStoresByUser, updateStore, deleteStore } from '../storage/storeRepository';
import { UserRole } from '../types';
import { createAuditLog } from '../storage/auditRepository';

const router = Router();

router.get('/', async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: '未授权' });
    }

    const stores = getStoresByUser(req.user);

    res.json({
      success: true,
      data: stores
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || '获取门店列表失败'
    });
  }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const store = getStoreById(id);

    if (!store) {
      return res.status(404).json({
        success: false,
        error: '门店不存在'
      });
    }

    res.json({
      success: true,
      data: store
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || '获取门店信息失败'
    });
  }
});

router.post(
  '/',
  requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]),
  validateRequestBody({
    name: { required: true, type: 'string' },
    address: { required: true, type: 'string' },
    contactPerson: { required: true, type: 'string' },
    contactPhone: { required: true, type: 'string' }
  }),
  async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: '未授权' });
      }

      const { name, address, contactPerson, contactPhone } = req.body;

      const store = createStore(name, address, contactPerson, contactPhone, req.user);

      createAuditLog('store', store.id, 'create', req.user, {
        afterState: store
      });

      res.status(201).json({
        success: true,
        data: store
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || '创建门店失败'
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
      const { name, address, contactPerson, contactPhone, isActive } = req.body;

      const existingStore = getStoreById(id);
      if (!existingStore) {
        return res.status(404).json({
          success: false,
          error: '门店不存在'
        });
      }

      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (address !== undefined) updates.address = address;
      if (contactPerson !== undefined) updates.contactPerson = contactPerson;
      if (contactPhone !== undefined) updates.contactPhone = contactPhone;
      if (isActive !== undefined) updates.isActive = isActive;

      const updatedStore = updateStore(id, updates, req.user);

      if (updatedStore) {
        createAuditLog('store', id, 'update', req.user, {
          beforeState: existingStore,
          afterState: updatedStore
        });
      }

      res.json({
        success: true,
        data: updatedStore
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || '更新门店失败'
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
      const existingStore = getStoreById(id);

      if (!existingStore) {
        return res.status(404).json({
          success: false,
          error: '门店不存在'
        });
      }

      const success = deleteStore(id, req.user);

      if (success) {
        createAuditLog('store', id, 'delete', req.user, {
          beforeState: existingStore
        });
      }

      res.json({
        success,
        message: success ? '删除成功' : '删除失败'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || '删除门店失败'
      });
    }
  }
);

export default router;
