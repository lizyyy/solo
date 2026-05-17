import { Router, Request, Response } from 'express';
import { importService } from '../services/importService';
import { verifyService } from '../services/verifyService';
import { exportService } from '../services/exportService';
import { queryService } from '../services/queryService';
import { OperationSource, RedApplyStatus } from '../types';

const router = Router();

router.post('/import', async (req: Request, res: Response) => {
  try {
    const { rows, operator, source } = req.body;
    if (!rows || !Array.isArray(rows)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: 'rows参数必须是数组',
          type: 'DATA_INCOMPLETE',
          suggestion: '请提供正确的导入数据格式'
        }
      });
    }
    const result = await importService.batchImport(
      rows,
      operator || 'system',
      source || OperationSource.IMPORT
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SYSTEM_ERROR',
        message: '系统处理异常',
        type: 'NEED_MANUAL',
        suggestion: '请稍后重试或联系技术支持'
      }
    });
  }
});

router.post('/:id/start-verify', async (req: Request, res: Response) => {
  try {
    const { operator, source } = req.body;
    const result = await verifyService.startVerify(
      req.params.id,
      operator || 'system',
      source || OperationSource.MANUAL
    );
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SYSTEM_ERROR',
        message: '系统处理异常',
        type: 'NEED_MANUAL',
        suggestion: '请稍后重试或联系技术支持'
      }
    });
  }
});

router.post('/:id/approve', async (req: Request, res: Response) => {
  try {
    const { operator, source } = req.body;
    const result = await verifyService.approveRedApply(
      req.params.id,
      operator || 'system',
      source || OperationSource.MANUAL
    );
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SYSTEM_ERROR',
        message: '系统处理异常',
        type: 'NEED_MANUAL',
        suggestion: '请稍后重试或联系技术支持'
      }
    });
  }
});

router.post('/:id/reject', async (req: Request, res: Response) => {
  try {
    const { rejectReason, operator, source } = req.body;
    if (!rejectReason) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: '驳回原因不能为空',
          type: 'DATA_INCOMPLETE',
          suggestion: '请提供驳回原因'
        }
      });
    }
    const result = await verifyService.rejectRedApply(
      req.params.id,
      rejectReason,
      operator || 'system',
      source || OperationSource.MANUAL
    );
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SYSTEM_ERROR',
        message: '系统处理异常',
        type: 'NEED_MANUAL',
        suggestion: '请稍后重试或联系技术支持'
      }
    });
  }
});

router.post('/:id/force-verify', async (req: Request, res: Response) => {
  try {
    const { remark, operator, source } = req.body;
    const result = await verifyService.forceVerify(
      req.params.id,
      operator || 'system',
      remark || '人工介入处理',
      source || OperationSource.MANUAL
    );
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SYSTEM_ERROR',
        message: '系统处理异常',
        type: 'NEED_MANUAL',
        suggestion: '请稍后重试或联系技术支持'
      }
    });
  }
});

router.get('/list', async (req: Request, res: Response) => {
  try {
    const filters = {
      status: req.query.status as RedApplyStatus | undefined,
      orderNo: req.query.orderNo as string | undefined,
      invoiceNumber: req.query.invoiceNumber as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined
    };
    const result = queryService.getList(filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SYSTEM_ERROR',
        message: '系统处理异常',
        type: 'NEED_MANUAL',
        suggestion: '请稍后重试或联系技术支持'
      }
    });
  }
});

router.get('/:id/detail', async (req: Request, res: Response) => {
  try {
    const result = queryService.getDetail(req.params.id);
    if (!result.success) {
      return res.status(404).json(result);
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SYSTEM_ERROR',
        message: '系统处理异常',
        type: 'NEED_MANUAL',
        suggestion: '请稍后重试或联系技术支持'
      }
    });
  }
});

router.get('/:id/history', async (req: Request, res: Response) => {
  try {
    const result = queryService.getHistory(req.params.id);
    if (!result.success) {
      return res.status(404).json(result);
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SYSTEM_ERROR',
        message: '系统处理异常',
        type: 'NEED_MANUAL',
        suggestion: '请稍后重试或联系技术支持'
      }
    });
  }
});

router.get('/statistics', async (_req: Request, res: Response) => {
  try {
    const result = queryService.getStatistics();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SYSTEM_ERROR',
        message: '系统处理异常',
        type: 'NEED_MANUAL',
        suggestion: '请稍后重试或联系技术支持'
      }
    });
  }
});

router.post('/export', async (req: Request, res: Response) => {
  try {
    const { ids, status } = req.body;
    let csv: string;
    let meta: any = {};

    if (ids && Array.isArray(ids)) {
      const result = exportService.exportByIds(ids);
      csv = result.csv;
      meta = { success: result.success, failed: result.failed };
    } else if (status) {
      csv = exportService.exportByStatus(status);
    } else {
      csv = exportService.exportToCSV();
    }

    res.json({ success: true, data: { csv, meta } });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SYSTEM_ERROR',
        message: '导出异常',
        type: 'NEED_MANUAL',
        suggestion: '请稍后重试或联系技术支持'
      }
    });
  }
});

export default router;
