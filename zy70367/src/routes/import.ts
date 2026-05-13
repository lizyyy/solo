import { Router } from 'express';
import { importService } from '../services/importService';
import { store } from '../store/memoryStore';

const router = Router();

router.post('/batches', (req, res) => {
  try {
    const { name, creatorId, users } = req.body;
    
    if (!name || !creatorId || !Array.isArray(users)) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: name, creatorId, users'
      });
    }
    
    const batch = importService.createBatch({ name, creatorId, users });
    
    res.status(201).json({
      success: true,
      data: {
        batch,
        records: store.getRecordsByBatchId(batch.id)
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error?.message || '创建批次失败'
    });
  }
});

router.get('/batches', (req, res) => {
  try {
    const batches = importService.getAllBatches();
    res.json({
      success: true,
      data: batches
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error?.message || '获取批次列表失败'
    });
  }
});

router.get('/batches/:batchId', (req, res) => {
  try {
    const { batchId } = req.params;
    const batch = importService.getBatch(batchId);
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        error: '批次不存在'
      });
    }
    
    const records = importService.getBatchRecords(batchId);
    
    res.json({
      success: true,
      data: {
        batch,
        records
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error?.message || '获取批次详情失败'
    });
  }
});

router.post('/batches/:batchId/precheck', (req, res) => {
  try {
    const { batchId } = req.params;
    const result = importService.precheckBatch(batchId);
    
    res.json({
      success: true,
      data: {
        batchId: result.batchId,
        totalWarnings: result.warnings.length,
        warnings: result.warnings,
        perUserWarnings: Object.fromEntries(result.perUserWarnings)
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error?.message || '预检失败'
    });
  }
});

router.post('/batches/:batchId/confirm', (req, res) => {
  try {
    const { batchId } = req.params;
    const result = importService.confirmImport(batchId);
    
    res.json({
      success: true,
      data: {
        batch: result.batch,
        results: result.results
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error?.message || '确认导入失败'
    });
  }
});

export default router;
