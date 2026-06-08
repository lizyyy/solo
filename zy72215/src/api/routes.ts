import express, { Request, Response } from 'express';
import { PerformanceAttributionService } from '../services/PerformanceAttributionService';
import { RawTradeRecord } from '../core/TradeRecordFactory';

const router = express.Router();

function handleTransitionResult(res: Response, result: { success: boolean; error?: string }, successMessage: string) {
  if (!result.success) {
    return res.status(409).json({ success: false, error: result.error });
  }
  res.json({ success: true, message: successMessage });
}

router.post('/import', (req: Request, res: Response) => {
  try {
    const { records, operator }: { records: RawTradeRecord[]; operator: string } = req.body;

    if (!records || !operator) {
      return res.status(400).json({ error: '缺少必要参数: records 和 operator' });
    }

    const result = PerformanceAttributionService.importRecords(records, operator);
    res.json({
      success: true,
      message: `成功导入 ${result.importedCount} 条记录`,
      zeroWithReversalCount: result.zeroWithReversalCount,
      data: result.records
    });
  } catch (error) {
    res.status(500).json({ error: '导入失败', details: (error as Error).message });
  }
});

router.get('/report/:date', (req: Request, res: Response) => {
  try {
    const { date } = req.params;
    const report = PerformanceAttributionService.getReport(date);
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: '获取报表失败', details: (error as Error).message });
  }
});

router.get('/page/:date', (req: Request, res: Response) => {
  try {
    const { date } = req.params;
    const data = PerformanceAttributionService.getPageData(date);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: '获取页面数据失败', details: (error as Error).message });
  }
});

router.get('/export/:date', (req: Request, res: Response) => {
  try {
    const { date } = req.params;
    const data = PerformanceAttributionService.getExportData(date);
    res.json({
      exportDate: date,
      totalRecords: data.length,
      data
    });
  } catch (error) {
    res.status(500).json({ error: '导出数据失败', details: (error as Error).message });
  }
});

router.get('/record/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const record = PerformanceAttributionService.getRecordDetail(id);

    if (!record) {
      return res.status(404).json({ error: '记录不存在' });
    }

    res.json(record);
  } catch (error) {
    res.status(500).json({ error: '获取记录详情失败', details: (error as Error).message });
  }
});

router.get('/record/:id/audit', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const auditTrail = PerformanceAttributionService.getAuditTrail(id);
    res.json({ recordId: id, auditTrail });
  } catch (error) {
    res.status(500).json({ error: '获取审计日志失败', details: (error as Error).message });
  }
});

router.post('/record/:id/submit-review', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { operator, custodianPageRef } = req.body;

    if (!operator) {
      return res.status(400).json({ error: '缺少操作人信息' });
    }

    const result = PerformanceAttributionService.submitForReview(id, operator, custodianPageRef);
    handleTransitionResult(res, result, '已提交风控复核');
  } catch (error) {
    res.status(500).json({ error: '提交复核失败', details: (error as Error).message });
  }
});

router.post('/record/:id/review-normal', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { operator, remark } = req.body;

    if (!operator) {
      return res.status(400).json({ error: '缺少操作人信息' });
    }

    const result = PerformanceAttributionService.reviewAsNormal(id, operator, remark);
    handleTransitionResult(res, result, '复核通过-确认为正常');
  } catch (error) {
    res.status(500).json({ error: '复核操作失败', details: (error as Error).message });
  }
});

router.post('/record/:id/review-adjust', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { operator, adjustedAmount, remark } = req.body;

    if (!operator || adjustedAmount === undefined) {
      return res.status(400).json({ error: '缺少必要参数: operator 和 adjustedAmount' });
    }

    const result = PerformanceAttributionService.reviewWithAdjustment(id, operator, adjustedAmount, remark);
    handleTransitionResult(res, result, '复核通过-已调整金额');
  } catch (error) {
    res.status(500).json({ error: '调整操作失败', details: (error as Error).message });
  }
});

router.post('/record/:id/summarize', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { operator } = req.body;

    if (!operator) {
      return res.status(400).json({ error: '缺少操作人信息' });
    }

    const result = PerformanceAttributionService.markAsSummarized(id, operator);
    handleTransitionResult(res, result, '已纳入摘要');
  } catch (error) {
    res.status(500).json({ error: '纳入摘要失败', details: (error as Error).message });
  }
});

router.post('/record/:id/rollback', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { operator, reason } = req.body;

    if (!operator || !reason) {
      return res.status(400).json({ error: '缺少必要参数: operator 和 reason' });
    }

    const result = PerformanceAttributionService.rollbackRecord(id, operator, reason);
    handleTransitionResult(res, result, '已回滚状态');
  } catch (error) {
    res.status(500).json({ error: '回滚失败', details: (error as Error).message });
  }
});

router.get('/summary/manager/:date', (req: Request, res: Response) => {
  try {
    const { date } = req.params;
    const summary = PerformanceAttributionService.getManagerSummary(date);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: '获取摘要失败', details: (error as Error).message });
  }
});

router.get('/zero-reversal/:date?', (req: Request, res: Response) => {
  try {
    const { date } = req.params;
    const records = PerformanceAttributionService.getZeroWithReversalRecords(date);
    res.json({ count: records.length, records });
  } catch (error) {
    res.status(500).json({ error: '查询失败', details: (error as Error).message });
  }
});

router.get('/pending-review/:date?', (req: Request, res: Response) => {
  try {
    const { date } = req.params;
    const records = PerformanceAttributionService.getPendingReviewRecords(date);
    res.json({ count: records.length, records });
  } catch (error) {
    res.status(500).json({ error: '查询失败', details: (error as Error).message });
  }
});

export default router;
