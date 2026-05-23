import { Router, Request, Response } from 'express';
import { BatchService, ExportService } from '../services';
import { BatchSubmitRequest, IdempotentStrategy } from '../types';

const router = Router();
const batchService = new BatchService();
const exportService = new ExportService();

router.post('/submit', async (req: Request, res: Response) => {
  try {
    const request: BatchSubmitRequest = req.body;
    
    if (!request.batchNo) {
      return res.status(400).json({
        success: false,
        error: '批次编号不能为空',
        traceId: req.traceId,
        timestamp: Date.now()
      });
    }

    if (!request.vin) {
      return res.status(400).json({
        success: false,
        error: 'VIN码不能为空',
        traceId: req.traceId,
        timestamp: Date.now()
      });
    }

    if (!request.strategy) {
      request.strategy = IdempotentStrategy.IGNORE;
    }

    const result = await batchService.submitBatch(
      request,
      req.ip,
      req.get('User-Agent')
    );

    const duration = Date.now() - req.requestTime;
    console.log(`[${req.traceId}] 批次提交完成: ${result.batchNo}, 状态: ${result.status}, 耗时: ${duration}ms`);

    res.json({
      success: true,
      data: result,
      message: result.isRetry ? '批次重新提交成功' : '批次提交成功',
      traceId: req.traceId,
      timestamp: Date.now()
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message,
      traceId: req.traceId,
      timestamp: Date.now()
    });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const { vin } = req.query;
    
    let batches;
    if (vin) {
      batches = await batchService.getBatchesByVin(vin as string);
    } else {
      batches = await batchService.getAllBatches();
    }

    res.json({
      success: true,
      data: batches,
      traceId: req.traceId,
      timestamp: Date.now()
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message,
      traceId: req.traceId,
      timestamp: Date.now()
    });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const detail = await batchService.getBatchDetail(req.params.id);
    
    if (!detail) {
      return res.status(404).json({
        success: false,
        error: '批次不存在',
        traceId: req.traceId,
        timestamp: Date.now()
      });
    }

    res.json({
      success: true,
      data: detail,
      traceId: req.traceId,
      timestamp: Date.now()
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message,
      traceId: req.traceId,
      timestamp: Date.now()
    });
  }
});

router.post('/:id/recall', async (req: Request, res: Response) => {
  try {
    const { operator, operatorRole, reason } = req.body;
    
    if (!operator) {
      return res.status(400).json({
        success: false,
        error: '操作人不能为空',
        traceId: req.traceId,
        timestamp: Date.now()
      });
    }

    const batch = await batchService.recallBatch(
      req.params.id,
      operator,
      operatorRole || 'operator',
      reason || ''
    );

    res.json({
      success: true,
      data: batch,
      message: '批次撤回成功',
      traceId: req.traceId,
      timestamp: Date.now()
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message,
      traceId: req.traceId,
      timestamp: Date.now()
    });
  }
});

router.post('/:id/freeze', async (req: Request, res: Response) => {
  try {
    const { operator, operatorRole } = req.body;
    
    if (!operator) {
      return res.status(400).json({
        success: false,
        error: '操作人不能为空',
        traceId: req.traceId,
        timestamp: Date.now()
      });
    }

    const batch = await batchService.freezeBatch(
      req.params.id,
      operator,
      operatorRole || 'operator'
    );

    res.json({
      success: true,
      data: batch,
      message: '批次冻结成功',
      traceId: req.traceId,
      timestamp: Date.now()
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message,
      traceId: req.traceId,
      timestamp: Date.now()
    });
  }
});

router.post('/:id/unfreeze', async (req: Request, res: Response) => {
  try {
    const { operator, operatorRole } = req.body;
    
    if (!operator) {
      return res.status(400).json({
        success: false,
        error: '操作人不能为空',
        traceId: req.traceId,
        timestamp: Date.now()
      });
    }

    const batch = await batchService.unfreezeBatch(
      req.params.id,
      operator,
      operatorRole || 'operator'
    );

    res.json({
      success: true,
      data: batch,
      message: '批次解冻成功',
      traceId: req.traceId,
      timestamp: Date.now()
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message,
      traceId: req.traceId,
      timestamp: Date.now()
    });
  }
});

router.post('/:id/export', async (req: Request, res: Response) => {
  try {
    const { operator, operatorRole } = req.body;
    
    if (!operator) {
      return res.status(400).json({
        success: false,
        error: '操作人不能为空',
        traceId: req.traceId,
        timestamp: Date.now()
      });
    }

    const exportPath = await exportService.exportBatch(
      req.params.id,
      operator,
      operatorRole || 'operator'
    );

    res.json({
      success: true,
      data: { exportPath },
      message: '批次导出成功',
      traceId: req.traceId,
      timestamp: Date.now()
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message,
      traceId: req.traceId,
      timestamp: Date.now()
    });
  }
});

router.post('/abnormal-photos/:id/manual-override', async (req: Request, res: Response) => {
  try {
    const { operator, operatorRole, reviewResult } = req.body;
    
    if (!operator) {
      return res.status(400).json({
        success: false,
        error: '操作人不能为空',
        traceId: req.traceId,
        timestamp: Date.now()
      });
    }

    if (!reviewResult) {
      return res.status(400).json({
        success: false,
        error: '审核结果不能为空',
        traceId: req.traceId,
        timestamp: Date.now()
      });
    }

    await batchService.manualOverride(
      req.params.id,
      operator,
      operatorRole || 'operator',
      reviewResult
    );

    res.json({
      success: true,
      message: '人工改判成功',
      traceId: req.traceId,
      timestamp: Date.now()
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message,
      traceId: req.traceId,
      timestamp: Date.now()
    });
  }
});

export default router;
