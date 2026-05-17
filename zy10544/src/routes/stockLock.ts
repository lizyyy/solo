import express, { Request, Response } from 'express';
import { stockLockService } from '../services/stockLockService';
import { exportService } from '../services/exportService';
import { CreateLockRequest, QueryLocksRequest, AdvanceStatusRequest, ManualCorrectionRequest, ResolveExceptionRequest } from '../types';

const router = express.Router();

router.post('/locks', async (req: Request, res: Response) => {
  try {
    const request: CreateLockRequest = req.body;
    if (!request.activityId || !request.skuItems || !request.releaseCondition) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: activityId, skuItems, releaseCondition',
      });
    }

    const result = await stockLockService.createLocks(request);
    res.status(201).json({
      success: result.success,
      message: result.success ? '库存锁定创建成功' : '部分SKU创建失败',
      locksCreated: result.locks.length,
      exceptions: result.exceptions.length,
      data: result.locks,
      exceptions: result.exceptions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: (error as Error).message,
    });
  }
});

router.get('/locks', async (req: Request, res: Response) => {
  try {
    const request: QueryLocksRequest = {
      activityId: req.query.activityId as string,
      sku: req.query.sku as string,
      status: req.query.status as any,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined,
    };

    const result = await stockLockService.queryLocks(request);
    res.json({
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: Math.ceil(result.total / result.pageSize),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: (error as Error).message,
    });
  }
});

router.post('/locks/advance', async (req: Request, res: Response) => {
  try {
    const request: AdvanceStatusRequest = req.body;
    if (!request.activityId || !request.requestId || !request.releaseCondition) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: activityId, requestId, releaseCondition',
      });
    }

    const result = await stockLockService.advanceStatus(request);
    res.json({
      success: result.success,
      message: result.success
        ? result.processed > 0
          ? `成功处理 ${result.processed} 个SKU`
          : '幂等处理，请求已执行过'
        : '处理过程出现异常',
      processed: result.processed,
      skipped: result.skipped,
      exceptions: result.exceptions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: (error as Error).message,
    });
  }
});

router.post('/locks/correct', async (req: Request, res: Response) => {
  try {
    const request: ManualCorrectionRequest = req.body;
    if (!request.lockId || !request.operator || !request.correctionReason) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: lockId, operator, correctionReason',
      });
    }

    const result = await stockLockService.manualCorrection(request);
    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json({
      success: true,
      message: '人工修正成功',
      data: result.lock,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: (error as Error).message,
    });
  }
});

router.get('/exceptions', async (req: Request, res: Response) => {
  try {
    const activityId = req.query.activityId as string;
    const exceptions = await stockLockService.queryExceptions(activityId);
    res.json({
      success: true,
      total: exceptions.length,
      data: exceptions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: (error as Error).message,
    });
  }
});

router.post('/exceptions/resolve', async (req: Request, res: Response) => {
  try {
    const request: ResolveExceptionRequest = req.body;
    if (!request.exceptionId || !request.operator || !request.resolution) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: exceptionId, operator, resolution',
      });
    }

    const result = await stockLockService.resolveException(request);
    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: '异常记录不存在',
      });
    }

    res.json({
      success: true,
      message: '异常已标记为解决',
      data: result.exception,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: (error as Error).message,
    });
  }
});

router.post('/reports/:activityId', async (req: Request, res: Response) => {
  try {
    const { activityId } = req.params;
    const { operator } = req.body;
    const report = await stockLockService.generateReport(activityId, operator);
    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: (error as Error).message,
    });
  }
});

router.get('/reports/:activityId/export', async (req: Request, res: Response) => {
  try {
    const { activityId } = req.params;
    const format = (req.query.format as string) || 'txt';

    const report = await stockLockService.generateReport(activityId);

    if (format === 'csv') {
      const csvContent = exportService.generateCsvReport(report);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="stock_report_${activityId}.csv"`);
      res.send(csvContent);
    } else {
      const txtContent = exportService.generateReadableReport(report);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="stock_report_${activityId}.txt"`);
      res.send(txtContent);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: (error as Error).message,
    });
  }
});

router.get('/exceptions/export', async (req: Request, res: Response) => {
  try {
    const activityId = req.query.activityId as string;
    const exceptions = await stockLockService.queryExceptions(activityId);
    const content = exportService.generateExceptionList(exceptions);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="exceptions_${activityId || 'all'}.txt"`);
    res.send(content);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: (error as Error).message,
    });
  }
});

router.get('/locks/export', async (req: Request, res: Response) => {
  try {
    const request: QueryLocksRequest = {
      activityId: req.query.activityId as string,
      sku: req.query.sku as string,
      status: req.query.status as any,
    };

    const result = await stockLockService.queryLocks({ ...request, pageSize: 10000 });
    const content = exportService.generateLockList(result.data);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="stock_locks.txt"`);
    res.send(content);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: (error as Error).message,
    });
  }
});

router.get('/reports', async (req: Request, res: Response) => {
  try {
    const activityId = req.query.activityId as string;
    const reports = await stockLockService.getReports(activityId);
    res.json({
      success: true,
      total: reports.length,
      data: reports,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: (error as Error).message,
    });
  }
});

export default router;
