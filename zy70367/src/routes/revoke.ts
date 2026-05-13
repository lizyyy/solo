import { Router } from 'express';
import { revokeService } from '../services/revokeService';
import { store } from '../store/memoryStore';
import { importService } from '../services/importService';

const router = Router();

router.post('/batches/:batchId/revoke', (req, res) => {
  try {
    const { batchId } = req.params;
    const { force } = req.body;
    
    const result = revokeService.revokeBatch(batchId, !!force);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error?.message || '撤销批次失败'
    });
  }
});

router.post('/batches/:batchId/revoke/:email', (req, res) => {
  try {
    const { batchId, email } = req.params;
    
    const result = revokeService.revokeSingleUser(batchId, decodeURIComponent(email));
    
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error?.message || '撤销单个用户失败'
    });
  }
});

router.get('/batches/:batchId/can-revoke', (req, res) => {
  try {
    const { batchId } = req.params;
    
    const batch = importService.getBatch(batchId);
    if (!batch) {
      return res.status(404).json({
        success: false,
        error: '批次不存在'
      });
    }
    
    const records = store.getRecordsByBatchId(batchId);
    const revokeStatuses = records.map(record => {
      const check = revokeService.canRevokeRecord(record);
      return {
        email: record.email,
        canRevoke: check.canRevoke,
        reason: check.reason,
        status: record.status,
        isPreExisting: record.isPreExisting
      };
    });
    
    const summary = {
      total: records.length,
      canRevoke: revokeStatuses.filter(r => r.canRevoke).length,
      cannotRevoke: revokeStatuses.filter(r => !r.canRevoke).length,
      preExistingUsers: records.filter(r => r.isPreExisting).length
    };
    
    res.json({
      success: true,
      data: {
        summary,
        details: revokeStatuses
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error?.message || '检查可撤销状态失败'
    });
  }
});

export default router;
