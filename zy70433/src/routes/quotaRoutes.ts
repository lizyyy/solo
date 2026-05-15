import { Router, Request, Response } from 'express';
import quotaService from '../services/quotaService';
import reportService from '../services/reportService';
import paymentService from '../services/paymentService';
import { runQuery } from '../database/db';

const router = Router();

router.post('/allocate', async (req: Request, res: Response) => {
  try {
    const { departmentId, ruleVersion, requestedAmount, callerId } = req.body;

    if (!departmentId || !ruleVersion || !requestedAmount) {
      return res.status(400).json({
        error: '缺少必要参数: departmentId, ruleVersion, requestedAmount',
      });
    }

    const result = await quotaService.allocateQuota({
      departmentId,
      ruleVersion,
      requestedAmount,
      callerId,
    });

    res.json({
      success: result.success,
      data: result,
      message: result.success ? '配额发放成功' : '配额发放失败',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/records', async (req: Request, res: Response) => {
  try {
    const { batchId, departmentId, status } = req.query;
    const records = await quotaService.getBatchRecords(
      batchId as string,
      departmentId as string,
      status as string
    );

    res.json({
      success: true,
      data: records,
      total: records.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/whitelist/review', async (_req: Request, res: Response) => {
  try {
    const whitelist = await quotaService.getWhitelistForReview();
    res.json({
      success: true,
      data: whitelist,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/report/generate', async (req: Request, res: Response) => {
  try {
    const { batchId } = req.body;
    if (!batchId) {
      return res.status(400).json({ error: '缺少 batchId 参数' });
    }

    const report = await reportService.generateReport(batchId);
    if (!report) {
      return res.status(404).json({ error: '批次不存在' });
    }

    res.json({
      success: true,
      data: report,
      message: '报告生成成功',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/reports', async (_req: Request, res: Response) => {
  try {
    const reports = await reportService.getAllReports();
    res.json({
      success: true,
      data: reports,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/report/:reportId', async (req: Request, res: Response) => {
  try {
    const report = await reportService.getReport(req.params.reportId);
    if (!report) {
      return res.status(404).json({ error: '报告不存在' });
    }
    res.json({ success: true, data: report });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/payment/receipt', async (req: Request, res: Response) => {
  try {
    const receipt = await paymentService.createReceipt(req.body);
    res.json({
      success: true,
      data: receipt,
      message: '回执创建成功',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/payment/receipts', async (req: Request, res: Response) => {
  try {
    const { callerId, batchId } = req.query;
    
    let receipts;
    if (callerId) {
      receipts = await paymentService.getReceiptsByCaller(callerId as string);
    } else if (batchId) {
      receipts = await paymentService.getReceiptsByBatch(batchId as string);
    } else {
      receipts = await paymentService.getAllReceipts();
    }

    res.json({
      success: true,
      data: receipts,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/departments', async (_req: Request, res: Response) => {
  try {
    const departments = await runQuery('SELECT * FROM departments ORDER BY name');
    res.json({ success: true, data: departments });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/rules', async (_req: Request, res: Response) => {
  try {
    const rules = await runQuery('SELECT * FROM rule_versions ORDER BY effective_date DESC');
    res.json({ success: true, data: rules });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/contracts', async (_req: Request, res: Response) => {
  try {
    const contracts = await runQuery(`
      SELECT 
        oc.*,
        d.name as department_name
      FROM offline_contracts oc
      LEFT JOIN departments d ON oc.department_id = d.id
      ORDER BY oc.created_at DESC
    `);
    res.json({ success: true, data: contracts });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
