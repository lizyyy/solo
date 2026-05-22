import { Router } from 'express';
import { authenticate, requirePermission, AuthenticatedRequest } from '../middleware/auth';
import { exportReconciliationResults, exportRawData, getExportHistory, verifyExportIntegrity } from '../services/exportService';

const router = Router();

router.post('/reconciliation/:taskId', authenticate, requirePermission('export'), async (req: AuthenticatedRequest, res) => {
  try {
    const { taskId } = req.params;
    const exportedBy = req.user?.username || 'system';
    
    const result = await exportReconciliationResults(taskId, exportedBy);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('导出对账结果失败:', error);
    res.status(500).json({ 
      error: '导出对账结果失败', 
      code: 'EXPORT_FAILED',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

router.post('/raw/:sourceType', authenticate, requirePermission('export'), async (req: AuthenticatedRequest, res) => {
  try {
    const { sourceType } = req.params;
    const { franchiseeId } = req.body;
    const exportedBy = req.user?.username || 'system';
    
    if (!['order', 'waste', 'price', 'supplement'].includes(sourceType)) {
      res.status(400).json({ error: '无效的数据源类型', code: 'INVALID_SOURCE_TYPE' });
      return;
    }

    const result = await exportRawData(
      sourceType as 'order' | 'waste' | 'price' | 'supplement',
      exportedBy,
      franchiseeId
    );
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('导出原始数据失败:', error);
    res.status(500).json({ 
      error: '导出原始数据失败', 
      code: 'EXPORT_FAILED',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

router.get('/history', authenticate, async (req, res) => {
  try {
    const history = await getExportHistory();
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('获取导出历史失败:', error);
    res.status(500).json({ 
      error: '获取导出历史失败', 
      code: 'EXPORT_HISTORY_FAILED'
    });
  }
});

router.get('/verify/:exportId', authenticate, async (req, res) => {
  try {
    const { exportId } = req.params;
    const isValid = await verifyExportIntegrity(exportId);
    
    res.json({
      success: true,
      data: { exportId, isValid }
    });
  } catch (error) {
    console.error('验证导出文件失败:', error);
    res.status(500).json({ 
      error: '验证导出文件失败', 
      code: 'VERIFY_FAILED'
    });
  }
});

export default router;
