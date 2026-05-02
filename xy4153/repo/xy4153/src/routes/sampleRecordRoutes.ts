import { Router } from 'express';
import { AuthRequest, requireRoles, validateRequestBody } from './middleware';
import { createSampleRecord, getSampleRecordById, getSampleRecordsByUser, updateSampleRecord, deleteSampleRecord } from '../storage/sampleRecordRepository';
import { getPoolById } from '../storage/poolRepository';
import { UserRole, SampleType } from '../types';
import { createAuditLog } from '../storage/auditRepository';
import { checkSampleRecordCreation } from '../rules/validationRules';

const router = Router();

router.get('/', async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: '未授权' });
    }

    const { startDate, endDate, sampleType, isExceeded } = req.query;
    
    const options: any = {};
    if (startDate) options.startDate = startDate as string;
    if (endDate) options.endDate = endDate as string;
    if (sampleType) options.sampleType = sampleType as SampleType;
    if (isExceeded !== undefined) options.isExceeded = isExceeded === 'true';

    const samples = getSampleRecordsByUser(req.user, options);

    res.json({
      success: true,
      data: samples
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || '获取采样记录列表失败'
    });
  }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const sample = getSampleRecordById(id);

    if (!sample) {
      return res.status(404).json({
        success: false,
        error: '采样记录不存在'
      });
    }

    res.json({
      success: true,
      data: sample
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || '获取采样记录信息失败'
    });
  }
});

router.post(
  '/',
  requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.STORE_STAFF]),
  validateRequestBody({
    storeId: { required: true, type: 'string' },
    poolId: { required: true, type: 'string' },
    sampleType: { required: true, type: 'string' },
    value: { required: true, type: 'number' },
    unit: { required: true, type: 'string' },
    sampleTime: { required: true, type: 'string' }
  }),
  async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: '未授权' });
      }

      const { storeId, poolId, sampleType, value, unit, sampleTime, recordedBy, deviceCalibrationId } = req.body;

      const pool = getPoolById(poolId);
      if (!pool) {
        return res.status(400).json({
          success: false,
          error: '泳池不存在'
        });
      }

      if (pool.storeId !== storeId) {
        return res.status(400).json({
          success: false,
          error: '泳池不属于指定门店'
        });
      }

      const validationResult = checkSampleRecordCreation(
        poolId,
        sampleType,
        value,
        sampleTime,
        deviceCalibrationId,
        req.user
      );

      if (!validationResult.valid) {
        return res.status(400).json({
          success: false,
          errors: validationResult.errors,
          warnings: validationResult.warnings
        });
      }

      const sample = createSampleRecord(
        storeId,
        poolId,
        sampleType,
        value,
        unit,
        sampleTime,
        recordedBy || req.user.username,
        deviceCalibrationId,
        req.user
      );

      createAuditLog('sample_record', sample.id, 'create', req.user, {
        afterState: sample
      });

      res.status(201).json({
        success: true,
        data: sample,
        warnings: validationResult.warnings
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || '创建采样记录失败'
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
      const existingSample = getSampleRecordById(id);

      if (!existingSample) {
        return res.status(404).json({
          success: false,
          error: '采样记录不存在'
        });
      }

      const success = deleteSampleRecord(id, req.user);

      if (success) {
        createAuditLog('sample_record', id, 'delete', req.user, {
          beforeState: existingSample
        });
      }

      res.json({
        success,
        message: success ? '删除成功' : '删除失败'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || '删除采样记录失败'
      });
    }
  }
);

export default router;
