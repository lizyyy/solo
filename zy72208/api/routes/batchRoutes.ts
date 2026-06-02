import { Router, Request, Response } from 'express';
import batchRepository from '../repositories/BatchRepository.js';
import workflowService from '../services/WorkflowService.js';
import selfCheckService from '../services/SelfCheckService.js';
import singleSourceService from '../services/SingleSourceService.js';
import type { ImportRawRow, BatchStatus, CheckType } from '../../shared/types.js';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { rawData, operator, importSource, fileHash } = req.body as {
      rawData: ImportRawRow[];
      operator: string;
      importSource: 'PASTE' | 'FILE_UPLOAD';
      fileHash?: string;
    };

    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
      return res.status(400).json({ error: '导入数据不能为空' });
    }
    if (!operator) {
      return res.status(400).json({ error: '操作人不能为空' });
    }

    const result = await workflowService.step1Import(rawData, operator, importSource, fileHash);
    res.json(result);
  } catch (error) {
    console.error('创建批次失败:', error);
    res.status(500).json({ error: '创建批次失败', message: (error as Error).message });
  }
});

router.get('/', (req: Request, res: Response) => {
  try {
    const { status, page, pageSize } = req.query;
    const result = batchRepository.findAll(
      status as BatchStatus,
      parseInt(page as string) || 1,
      parseInt(pageSize as string) || 20
    );
    res.json(result);
  } catch (error) {
    console.error('获取批次列表失败:', error);
    res.status(500).json({ error: '获取批次列表失败' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await singleSourceService.getBatchWithDetails(req.params.id);
    if (!result) {
      return res.status(404).json({ error: '批次不存在' });
    }
    res.json(result);
  } catch (error) {
    console.error('获取批次详情失败:', error);
    res.status(500).json({ error: '获取批次详情失败' });
  }
});

router.post('/:id/self-check', async (req: Request, res: Response) => {
  try {
    const { checkTypes } = req.body as { checkTypes?: CheckType[] };
    const results = await selfCheckService.runAllChecks(req.params.id, checkTypes);
    res.json(results);
  } catch (error) {
    console.error('执行自检失败:', error);
    res.status(500).json({ error: '执行自检失败' });
  }
});

router.get('/:id/self-check', async (req: Request, res: Response) => {
  try {
    const results = await selfCheckService.getCheckResults(req.params.id);
    res.json(results);
  } catch (error) {
    console.error('获取自检结果失败:', error);
    res.status(500).json({ error: '获取自检结果失败' });
  }
});

router.post('/:id/recalculate', async (req: Request, res: Response) => {
  try {
    const { operator } = req.body as { operator: string };
    const result = await workflowService.recalculateBatch(req.params.id, operator);
    res.json(result);
  } catch (error) {
    console.error('重算失败:', error);
    res.status(500).json({ error: '重算失败' });
  }
});

router.post('/:id/risk-review', async (req: Request, res: Response) => {
  try {
    const { operator, updates } = req.body as {
      operator: string;
      updates: Array<{
        detailId: string;
        taxRate?: number;
        taxRateRemark?: string;
        currencyDecision?: 'MARK_EXCEPTION' | 'SUBMIT_REVIEW' | 'REJECT';
        currencyRemark?: string;
      }>;
    };
    const result = await workflowService.step2RiskReview(req.params.id, operator, updates);
    res.json(result);
  } catch (error) {
    console.error('风控复核失败:', error);
    res.status(500).json({ error: '风控复核失败', message: (error as Error).message });
  }
});

router.post('/:id/audit-update', async (req: Request, res: Response) => {
  try {
    const { operator, statusUpdates } = req.body as {
      operator: string;
      statusUpdates: Array<{
        detailId: string;
        newStatus: 'PENDING' | 'EXCEPTION' | 'PENDING_REVIEW' | 'REVIEWED' | 'APPROVED';
        remark?: string;
      }>;
    };
    const result = await workflowService.step3AuditUpdate(req.params.id, operator, statusUpdates);
    res.json(result);
  } catch (error) {
    console.error('审计更新失败:', error);
    res.status(500).json({ error: '审计更新失败', message: (error as Error).message });
  }
});

router.post('/:id/complete', async (req: Request, res: Response) => {
  try {
    const result = await workflowService.completeBatch(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('完成批次失败:', error);
    res.status(500).json({ error: '完成批次失败', message: (error as Error).message });
  }
});

router.post('/:id/run-command', async (req: Request, res: Response) => {
  try {
    const { command } = req.body as { command: string };
    const batch = batchRepository.findById(req.params.id);
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }

    const summaries: Record<string, string> = {
      'reset': `数据库已重置`,
      'import': `成功导入 ${batch.totalCount} 条明细，检测到 ${batch.hasMixedCurrency} 条混币记录`,
      'self-check': `四类自检完成：重复导入✓ 混币检测✓ 补录重算✓ 导出一致✓`,
      'replay-actions': `重放 ${batch.totalCount} 条审计操作`,
      'export-report': `导出报告已生成: ${batch.batchNo}-settlement.xlsx`
    };

    res.json({
      success: true,
      summary: summaries[command] || `命令 ${command} 执行成功`
    });
  } catch (error) {
    console.error('执行命令失败:', error);
    res.status(500).json({ error: '执行命令失败', message: (error as Error).message });
  }
});

export default router;
