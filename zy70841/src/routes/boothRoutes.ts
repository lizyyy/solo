import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { BoothStatus } from '../types';
import { csvParser } from '../services/csvParser';
import { batchProcessService } from '../services/batchProcessService';
import { store } from '../store/memoryStore';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传CSV文件' });
    }

    const batchId = req.body.batchId || uuidv4();
    const applications = await csvParser.parseApplications(req.file.buffer, batchId);

    if (applications.length === 0) {
      return res.status(400).json({ error: 'CSV文件中没有有效数据' });
    }

    const report = await batchProcessService.processBatch(applications, batchId);

    const normalItems = report.results.filter(r => r.status === BoothStatus.NORMAL);
    const pendingItems = report.results.filter(r => r.status === BoothStatus.PENDING);
    const failedItems = report.results.filter(r => r.status === BoothStatus.FAILED);

    res.json({
      success: true,
      reportId: report.reportId,
      batchId: report.batchId,
      summary: {
        total: report.totalCount,
        normal: report.normalCount,
        pending: report.pendingCount,
        failed: report.failedCount
      },
      normalItems,
      pendingItems,
      failedItems,
      generatedAt: report.generatedAt
    });
  } catch (error) {
    console.error('上传处理错误:', error);
    res.status(500).json({ error: '处理CSV文件失败', message: (error as Error).message });
  }
});

router.get('/reports', (_req: Request, res: Response) => {
  try {
    const reports = batchProcessService.getAllReports();
    res.json({
      success: true,
      data: reports.map(r => ({
        reportId: r.reportId,
        batchId: r.batchId,
        summary: {
          total: r.totalCount,
          normal: r.normalCount,
          pending: r.pendingCount,
          failed: r.failedCount
        },
        generatedAt: r.generatedAt
      }))
    });
  } catch (error) {
    res.status(500).json({ error: '获取报告列表失败' });
  }
});

router.get('/reports/:reportId', (req: Request, res: Response) => {
  try {
    const report = batchProcessService.getReportById(req.params.reportId);
    
    if (!report) {
      return res.status(404).json({ error: '报告不存在' });
    }

    const normalItems = report.results.filter(r => r.status === BoothStatus.NORMAL);
    const pendingItems = report.results.filter(r => r.status === BoothStatus.PENDING);
    const failedItems = report.results.filter(r => r.status === BoothStatus.FAILED);

    res.json({
      success: true,
      reportId: report.reportId,
      batchId: report.batchId,
      summary: {
        total: report.totalCount,
        normal: report.normalCount,
        pending: report.pendingCount,
        failed: report.failedCount
      },
      normalItems,
      pendingItems,
      failedItems,
      generatedAt: report.generatedAt
    });
  } catch (error) {
    res.status(500).json({ error: '获取报告失败' });
  }
});

router.get('/trace/:traceId', (req: Request, res: Response) => {
  try {
    const { result, report } = batchProcessService.getTraceDetail(req.params.traceId);
    
    if (!result) {
      return res.status(404).json({ error: '追踪记录不存在' });
    }

    res.json({
      success: true,
      traceId: req.params.traceId,
      detail: result,
      report: report ? {
        reportId: report.reportId,
        batchId: report.batchId,
        generatedAt: report.generatedAt
      } : null
    });
  } catch (error) {
    res.status(500).json({ error: '获取追踪详情失败' });
  }
});

router.get('/applications/:applicationId/trace', (req: Request, res: Response) => {
  try {
    const trace = batchProcessService.getApplicationTrace(req.params.applicationId);
    
    if (!trace.application) {
      return res.status(404).json({ error: '申请记录不存在' });
    }

    res.json({
      success: true,
      data: {
        application: trace.application,
        validationResult: trace.result,
        report: trace.report ? {
          reportId: trace.report.reportId,
          batchId: trace.report.batchId,
          generatedAt: trace.report.generatedAt
        } : null
      }
    });
  } catch (error) {
    res.status(500).json({ error: '获取申请追踪详情失败' });
  }
});

router.get('/calendar', (_req: Request, res: Response) => {
  try {
    const events = store.getCalendarEvents();
    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    res.status(500).json({ error: '获取日历数据失败' });
  }
});

router.get('/submissions', (_req: Request, res: Response) => {
  try {
    const submissions = store.getAllSubmissions();
    res.json({
      success: true,
      data: submissions
    });
  } catch (error) {
    res.status(500).json({ error: '获取提交记录失败' });
  }
});

export default router;
