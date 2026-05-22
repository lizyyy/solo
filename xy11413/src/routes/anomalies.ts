import { Router } from 'express';
import { authenticate, requirePermission, AuthenticatedRequest } from '../middleware/auth';
import { getOpenAnomalies, getAnomaliesByTaskId, resolveAnomaly } from '../services/anomalyService';

const router = Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const { taskId } = req.query;
    let anomalies;
    
    if (taskId && typeof taskId === 'string') {
      anomalies = await getAnomaliesByTaskId(taskId);
    } else {
      anomalies = await getOpenAnomalies();
    }
    
    res.json({
      success: true,
      data: anomalies
    });
  } catch (error) {
    console.error('获取异常列表失败:', error);
    res.status(500).json({ 
      error: '获取异常列表失败', 
      code: 'ANOMALY_LIST_FAILED'
    });
  }
});

router.post('/:anomalyId/resolve', authenticate, requirePermission('resolve_anomalies'), async (req: AuthenticatedRequest, res) => {
  try {
    const { anomalyId } = req.params;
    const { resolution } = req.body;
    const resolvedBy = req.user?.username || 'system';
    
    if (!resolution) {
      res.status(400).json({ error: '缺少解决方案', code: 'MISSING_RESOLUTION' });
      return;
    }

    const success = await resolveAnomaly(anomalyId, resolution, resolvedBy);
    
    if (!success) {
      res.status(404).json({ error: '异常记录不存在', code: 'ANOMALY_NOT_FOUND' });
      return;
    }
    
    res.json({
      success: true,
      message: '异常已解决'
    });
  } catch (error) {
    console.error('解决异常失败:', error);
    res.status(500).json({ 
      error: '解决异常失败', 
      code: 'RESOLVE_FAILED'
    });
  }
});

export default router;
