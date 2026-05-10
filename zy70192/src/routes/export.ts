import { Router, Request, Response } from 'express';
import { successResponse, errorResponse, AppError } from '../utils/response';
import * as exportService from '../services/exportService';
import * as backgroundTaskService from '../services/backgroundTaskService';

const router = Router();

router.get('/overview', (req: Request, res: Response) => {
  try {
    const overview = exportService.getSystemOverview();
    res.json(successResponse(overview));
  } catch (error) {
    console.error('Get system overview error:', error);
    res.status(500).json(errorResponse('获取系统概览失败'));
  }
});

router.get('/samples/csv', (req: Request, res: Response) => {
  try {
    const csv = exportService.exportSampleCSV();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=samples-${Date.now()}.csv`);
    res.send('\ufeff' + csv);
  } catch (error) {
    console.error('Export samples CSV error:', error);
    res.status(500).json(errorResponse('导出样品列表失败'));
  }
});

router.get('/samples/:id/report', (req: Request, res: Response) => {
  try {
    const report = exportService.getSampleFullReport(req.params.id);
    res.json(successResponse(report));
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json(errorResponse(error.message, error.errorCode));
    }
    console.error('Get sample report error:', error);
    res.status(500).json(errorResponse('获取样品报告失败'));
  }
});

router.get('/samples/:id/report/csv', (req: Request, res: Response) => {
  try {
    const csv = exportService.exportSampleReportCSV(req.params.id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=sample-report-${req.params.id}-${Date.now()}.csv`);
    res.send('\ufeff' + csv);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json(errorResponse(error.message, error.errorCode));
    }
    console.error('Export sample report CSV error:', error);
    res.status(500).json(errorResponse('导出样品报告失败'));
  }
});

router.post('/samples/:id/report/async', (req: Request, res: Response) => {
  try {
    const task = backgroundTaskService.createBackgroundTask(
      'GENERATE_REPORT',
      { sampleId: req.params.id }
    );
    res.status(202).json(successResponse(task, '异步报告生成任务已提交'));
  } catch (error) {
    console.error('Create async report task error:', error);
    res.status(500).json(errorResponse('创建异步报告任务失败'));
  }
});

export default router;
