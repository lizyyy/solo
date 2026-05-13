import { Router } from 'express';
import { reportService } from '../services/reportService';
import { store } from '../store/memoryStore';

const router = Router();

router.get('/batches/:batchId/report', (req, res) => {
  try {
    const { batchId } = req.params;
    const report = reportService.generateBatchReport(batchId);
    
    res.json({
      success: true,
      data: report
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error?.message || '生成批次报告失败'
    });
  }
});

router.get('/users', (req, res) => {
  try {
    const users = reportService.getUsersWithBatchSource();
    
    res.json({
      success: true,
      data: users
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error?.message || '获取用户列表失败'
    });
  }
});

router.get('/users/:email', (req, res) => {
  try {
    const { email } = req.params;
    const user = reportService.getUserDetailWithBatchInfo(decodeURIComponent(email));
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: '用户不存在'
      });
    }
    
    res.json({
      success: true,
      data: user
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error?.message || '获取用户详情失败'
    });
  }
});

router.get('/batches/:batchId/reimport-context', (req, res) => {
  try {
    const { batchId } = req.params;
    const context = reportService.getReimportContext(batchId);
    
    res.json({
      success: true,
      data: context
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error?.message || '获取重新导入上下文失败'
    });
  }
});

export default router;
