import { Router, Request, Response } from 'express';
import { importService } from '../services/import.service';
import { reviewService } from '../services/review.service';
import { storageService } from '../services/storage.service';
import { ImportRequest, DetentionFeeStatus } from '../types/detention-fee';

const router = Router();

router.post('/import', (req: Request, res: Response) => {
  try {
    const request: ImportRequest = req.body;
    
    if (!request.records || !Array.isArray(request.records)) {
      return res.status(400).json({
        success: false,
        message: '缺少records参数或格式不正确'
      });
    }

    if (!request.operatorId || !request.operatorName) {
      return res.status(400).json({
        success: false,
        message: '缺少操作员信息'
      });
    }

    const result = importService.import(request);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '导入处理失败',
      error: (error as Error).message
    });
  }
});

router.post('/review/manual', (req: Request, res: Response) => {
  try {
    const result = reviewService.submitManualReview(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '人工审核处理失败',
      error: (error as Error).message
    });
  }
});

router.get('/records', (req: Request, res: Response) => {
  try {
    const records = storageService.findAll();
    res.json({
      success: true,
      count: records.length,
      records
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '查询记录失败',
      error: (error as Error).message
    });
  }
});

router.get('/records/pending-review', (req: Request, res: Response) => {
  try {
    const records = reviewService.getPendingReviewRecords();
    res.json({
      success: true,
      count: records.length,
      records
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '查询待审核记录失败',
      error: (error as Error).message
    });
  }
});

router.get('/records/:id', (req: Request, res: Response) => {
  try {
    const record = storageService.findById(req.params.id);
    if (!record) {
      return res.status(404).json({
        success: false,
        message: '记录不存在'
      });
    }
    res.json({
      success: true,
      record
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '查询记录失败',
      error: (error as Error).message
    });
  }
});

router.patch('/records/:id/status', (req: Request, res: Response) => {
  try {
    const { status, operatorId } = req.body;
    const currentStatus = storageService.getStatus(req.params.id);
    
    if (!currentStatus) {
      return res.status(404).json({
        success: false,
        message: '记录不存在'
      });
    }

    if (!importService.checkStatusTransition(currentStatus, status as DetentionFeeStatus)) {
      return res.status(400).json({
        success: false,
        message: `状态从 ${currentStatus} 跳转到 ${status} 不符合流程规则`,
        suggestion: '请按顺序逐级推进状态'
      });
    }

    const updatedRecord = storageService.updateStatus(req.params.id, status as DetentionFeeStatus, operatorId);
    res.json({
      success: true,
      message: '状态更新成功',
      record: updatedRecord
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '状态更新失败',
      error: (error as Error).message
    });
  }
});

export default router;
